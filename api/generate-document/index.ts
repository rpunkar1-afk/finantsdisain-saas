// Netlify Function (v2, Web API handler)
// Dokumendigeneraatori endpoint: POST /api/generate-document
// Sisend: { typeId: string, input: Record<string, string | number> }
// Väljund: GeneratedDocument (sektsioonid + document_id)
// Salvestab tulemuse Netlify Blobs'i ("documents" store), et /api/document-{docx,xlsx,pdf}
// saaks selle hiljem eraldi GET päringuga id järgi taastada ja lõplikuks failiks vormistada.

import { generateDocument, type GeneratedDocument } from "../../lib/documents/generate";
import { getDocumentType } from "../../lib/documents/registry";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

export const config = {
  path: "/api/generate-document",
};

interface RequestBody {
  typeId: string;
  input: Record<string, string | number>;
}

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
    body = (await req.json()) as RequestBody;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!body.typeId || !getDocumentType(body.typeId)) {
    return jsonResponse({ error: `Tundmatu dokumenditüüp: "${body.typeId}"` }, 400);
  }
  if (!body.input || typeof body.input !== "object") {
    return jsonResponse({ error: "'input' peab olema objekt" }, 400);
  }

  try {
    const documentId = randomUUID();
    const document: GeneratedDocument = await generateDocument(
      body.typeId,
      body.input,
      apiKey,
      documentId,
    );

    try {
      const store = getStore("documents");
      await store.setJSON(documentId, document, {
        metadata: { type_id: body.typeId, generated_at: document.generated_at },
      });
    } catch (err) {
      console.error("Dokumendi blob salvestus ebaõnnestus:", err);
    }

    return jsonResponse(document, 200);
  } catch (err) {
    return jsonResponse({ error: "Dokumendi genereerimine ebaõnnestus", detail: String(err) }, 502);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
