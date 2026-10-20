// Netlify Function (v2, Web API handler)
// P.E.E.T.E.R. vestlusendpoint: POST /api/peeter-chat
// Stateless — klient saadab kogu ajaloo + praeguse kogutud väljade seisu igal käigul.
//
// KRIITILINE REEGEL: number-tüüpi väljad EI salvestu kunagi otse Claude'i tool-kutsest.
// Server tagastab need kui "pendingConfirmation" — klient kuvab kinnitusvormi ja alles
// kasutaja kinnitusel liigub väärtus järgmises käigus "collected" hulka. Tekstiväljad
// (ärikirjeldus, turg, meeskond) võivad salvestuda otse, sest need on niigi vaba-vormis
// narratiivi sisend, mitte arvutuslik alus.

import Anthropic from "@anthropic-ai/sdk";
import { getDocumentType, type DocField } from "../../lib/documents/registry";
import { buildMenuSystemPrompt, buildCollectionSystemPrompt } from "../../lib/peeter/prompt";

export const config = {
  path: "/api/peeter-chat",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  documentTypeId: string | null;
  collected: Record<string, string | number>;
}

interface ResponseBody {
  reply: string;
  documentTypeId: string | null;
  fieldUpdates: Record<string, string>; // tekstiväljad, mis salvestusid kohe
  pendingConfirmation: { field_id: string; label: string; value: string; unit?: string } | null;
  readyToGenerate: boolean;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TOOL_ROUNDS = 3;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "select_document_type",
    description: "Vali sobiv dokumenditüüp kasutaja vajaduse põhjal.",
    input_schema: {
      type: "object",
      properties: {
        type_id: { type: "string", description: "Dokumenditüübi id registrist (nt 'ariplaan', 'swot')." },
      },
      required: ["type_id"],
    },
  },
  {
    name: "propose_field",
    description:
      "Registreeri kasutaja poolt äsja antud vastus ühele väljale. Tekstiväljad salvestuvad kohe, arvväljad vajavad kasutaja kinnitust. Kui kasutaja andis korraga mitme välja info, kutsu tööriista iga välja jaoks samas vastuses.",
    input_schema: {
      type: "object",
      properties: {
        field_id: { type: "string" },
        value: { type: "string", description: "Väärtus stringina (numbrite puhul ilma ühikuta, nt '45000')." },
        field_type: { type: "string", enum: ["text", "textarea", "number", "select"] },
      },
      required: ["field_id", "value", "field_type"],
    },
  },
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Server misconfiguration: ANTHROPIC_API_KEY puudub" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "'messages' peab olema mittetühi massiiv" }, 400);
  }

  const collected = body.collected ?? {};
  const anthropic = new Anthropic({ apiKey });

  const result: ResponseBody = {
    reply: "",
    documentTypeId: body.documentTypeId,
    fieldUpdates: {},
    pendingConfirmation: null,
    readyToGenerate: false,
  };

  // Kogumisfaasis on dokumenditüüp juba valitud. Kui select_document_type on siis
  // saadaval, kutsub Claude seda korduvalt uuesti ega salvesta kasutaja vastust.
  // Tööriistade hulk jääb kogu päringu ajaks samaks, sest ajalugu viitab neile.
  const tools = body.documentTypeId ? TOOLS.filter((t) => t.name === "propose_field") : TOOLS;

  const conversation: Anthropic.MessageParam[] = body.messages.map((m) => ({ role: m.role, content: m.content }));

  // Tööriistatsükkel: iga ringi tool-kutsed töödeldakse, tulemused saadetakse tagasi ja
  // tsükkel lõpeb, kui Claude vastab tekstiga ilma tööriistata. Tööriista kõrval olev
  // tekst on tavaliselt vaid sissejuhatus ("Salvestan nime."), mitte järgmine küsimus.
  let lastText = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let systemPrompt: string;
    try {
      const mergedCollected = { ...collected, ...result.fieldUpdates };
      systemPrompt = result.documentTypeId
        ? buildCollectionSystemPrompt(result.documentTypeId, mergedCollected)
        : buildMenuSystemPrompt();
    } catch (err) {
      return jsonResponse({ error: String(err) }, 400);
    }

    let message;
    try {
      message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 500,
        system: systemPrompt,
        tools,
        messages: conversation,
      });
    } catch (err) {
      if (round === 0) {
        return jsonResponse({ error: "Claude API kutse ebaõnnestus", detail: String(err) }, 502);
      }
      console.error("Peetri järelkutse ebaõnnestus:", err);
      break;
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) lastText = text;

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      result.reply = text;
      break;
    }

    for (const block of toolUses) applyToolUse(block, result);

    conversation.push(
      { role: "assistant", content: message.content },
      {
        role: "user",
        content: toolUses.map((t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: toolResultText(t, result),
        })),
      },
    );
  }

  if (!result.reply) result.reply = lastText;

  let nextMissing: DocField | undefined;
  if (result.documentTypeId) {
    const typeConfig = getDocumentType(result.documentTypeId);
    if (typeConfig) {
      const mergedCollected = { ...collected, ...result.fieldUpdates };
      const missing = typeConfig.fields.filter((f) => f.required && !(f.id in mergedCollected));
      result.readyToGenerate = missing.length === 0;
      nextMissing = missing.find((f) => f.id !== result.pendingConfirmation?.field_id);
    }
  }

  // Tühi vastus tekib, kui tööriistaringid said otsa enne, kui Claude teksti kirjutas.
  // Siis sõnastab server järgmise sammu ise kogutud oleku põhjal.
  if (!result.reply) {
    if (result.pendingConfirmation) {
      result.reply = "Palun kinnita allolev väärtus.";
    } else if (result.readyToGenerate) {
      result.reply = "Kõik vajalikud andmed on olemas. Dokument on valmis genereerimiseks.";
    } else if (nextMissing) {
      result.reply = `Järgmisena vajan: ${nextMissing.label.toLowerCase()}.`;
    } else {
      result.reply = "Kirjelda palun lühidalt, millist dokumenti vajad.";
    }
  }

  return jsonResponse(result, 200);
}

function applyToolUse(block: Anthropic.ToolUseBlock, result: ResponseBody): void {
  if (block.name === "select_document_type") {
    const input = block.input as { type_id?: string };
    if (input.type_id && getDocumentType(input.type_id)) {
      result.documentTypeId = input.type_id;
    }
  } else if (block.name === "propose_field") {
    const input = block.input as { field_id?: string; value?: string; field_type?: string };
    if (!input.field_id || input.value === undefined) return;

    if (input.field_type === "number") {
      if (!result.pendingConfirmation) {
        const typeConfig = result.documentTypeId ? getDocumentType(result.documentTypeId) : undefined;
        const fieldDef = typeConfig?.fields.find((f) => f.id === input.field_id);
        result.pendingConfirmation = {
          field_id: input.field_id,
          label: fieldDef?.label ?? input.field_id,
          value: input.value,
          unit: fieldDef?.unit,
        };
      }
    } else {
      result.fieldUpdates[input.field_id] = input.value;
    }
  }
}

function toolResultText(tool: Anthropic.ToolUseBlock, result: ResponseBody): string {
  if (tool.name === "select_document_type") {
    return result.documentTypeId
      ? `Valitud dokumenditüüp: ${result.documentTypeId}. Kui kasutaja on vestluses juba andnud mõne välja info, salvesta nüüd KÕIK need "propose_field" kutsetega (üks kutse välja kohta). Seejärel küsi esimest puuduvat välja.`
      : "Tundmatu dokumenditüüp. Täpsusta kasutajalt vajadust.";
  }
  const input = tool.input as { field_id?: string };
  if (result.pendingConfirmation && result.pendingConfirmation.field_id === input.field_id) {
    return "Arvväärtus ootab kasutaja kinnitust. Palu kasutajal allolev väärtus kinnitada; ära küsi järgmist välja.";
  }
  return "Salvestatud. Kui kasutaja andis veel välju, mida pole salvestatud, salvesta ka need. Muidu küsi järgmist puuduvat välja; ära väida, et andmed on koos, kui süsteemiprompt näitab puuduvaid välju.";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
