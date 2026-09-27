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
import { getDocumentType } from "../../lib/documents/registry";
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
      "Registreeri kasutaja poolt äsja antud vastus ühele väljale. Tekstiväljad salvestuvad kohe, arvväljad vajavad kasutaja kinnitust.",
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

  let systemPrompt: string;
  try {
    systemPrompt = body.documentTypeId
      ? buildCollectionSystemPrompt(body.documentTypeId, collected)
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
      tools: TOOLS,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    return jsonResponse({ error: "Claude API kutse ebaõnnestus", detail: String(err) }, 502);
  }

  const result: ResponseBody = {
    reply: "",
    documentTypeId: body.documentTypeId,
    fieldUpdates: {},
    pendingConfirmation: null,
    readyToGenerate: false,
  };

  const textParts: string[] = [];

  for (const block of message.content) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      if (block.name === "select_document_type") {
        const input = block.input as { type_id?: string };
        if (input.type_id && getDocumentType(input.type_id)) {
          result.documentTypeId = input.type_id;
        }
      } else if (block.name === "propose_field") {
        const input = block.input as { field_id?: string; value?: string; field_type?: string };
        if (!input.field_id || input.value === undefined) continue;

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
  }

  result.reply = textParts.join("\n").trim();

  // Kui Claude kutsus ainult tööriista ja ei kirjutanud teksti, jääks kasutaja ilma
  // järgmise küsimuseta. Teine kutse (tool_result + tool_choice "none") sunnib
  // Peetrit sõnastama järgmise sammu uue oleku põhjal.
  if (!result.reply) {
    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length > 0) {
      try {
        const mergedCollected = { ...collected, ...result.fieldUpdates };
        const followUpSystem = result.documentTypeId
          ? buildCollectionSystemPrompt(result.documentTypeId, mergedCollected)
          : buildMenuSystemPrompt();
        const followUp = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 500,
          system: followUpSystem,
          tools: TOOLS,
          tool_choice: { type: "none" },
          messages: [
            ...body.messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "assistant", content: message.content },
            {
              role: "user",
              content: toolUses.map((t) => ({
                type: "tool_result" as const,
                tool_use_id: t.id,
                content: toolResultText(t, result),
              })),
            },
          ],
        });
        result.reply = followUp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
      } catch (err) {
        console.error("Peetri järelkutse ebaõnnestus:", err);
      }
    }
  }

  if (!result.reply) {
    result.reply = result.pendingConfirmation
      ? "Palun kinnita allolev väärtus."
      : "Andmed puuduvad. Kirjelda palun täpsemalt.";
  }

  if (result.documentTypeId) {
    const typeConfig = getDocumentType(result.documentTypeId);
    if (typeConfig) {
      const mergedCollected = { ...collected, ...result.fieldUpdates };
      result.readyToGenerate = typeConfig.fields
        .filter((f) => f.required)
        .every((f) => f.id in mergedCollected);
    }
  }

  return jsonResponse(result, 200);
}

function toolResultText(tool: Anthropic.ToolUseBlock, result: ResponseBody): string {
  if (tool.name === "select_document_type") {
    return result.documentTypeId
      ? `Valitud dokumenditüüp: ${result.documentTypeId}. Küsi esimest puuduvat välja.`
      : "Tundmatu dokumenditüüp. Täpsusta kasutajalt vajadust.";
  }
  const input = tool.input as { field_id?: string };
  if (result.pendingConfirmation && result.pendingConfirmation.field_id === input.field_id) {
    return "Arvväärtus ootab kasutaja kinnitust. Palu kasutajal allolev väärtus kinnitada; ära küsi järgmist välja.";
  }
  return "Salvestatud. Küsi järgmist puuduvat välja.";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
