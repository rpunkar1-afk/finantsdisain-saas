// Netlify Function (v2, Web API handler)
// Samm 3: Normaliseerija endpoint
// Sisend: Sammu 2 (parse-statement) JSON väljund
// Väljund: ühtne struktuur (date, amount, description, merchant, category, account, balance)

import { normalizeStatement, type RawParseResult, type NormalizedStatement } from "../../lib/normalization";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

export const config = {
  path: "/api/normalize",
};

export interface NormalizedStatementWithId extends NormalizedStatement {
  profile_blob_id: string; // Samm 12: viide salvestatud JSON profiilile
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const blobId = url.searchParams.get("blob_id");
    if (!blobId) {
      return jsonResponse({ error: "Query param 'blob_id' on kohustuslik GET päringul" }, 400);
    }
    try {
      const profilesStore = getStore("profiles");
      const data = await profilesStore.get(blobId, { type: "json" });
      if (!data) {
        return jsonResponse({ error: `Profiili id="${blobId}" ei leitud` }, 404);
      }
      return jsonResponse(data, 200);
    } catch (err) {
      return jsonResponse({ error: "Profiili taastamine ebaõnnestus", detail: String(err) }, 500);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let raw: RawParseResult;
  try {
    raw = (await req.json()) as RawParseResult;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!raw || !Array.isArray(raw.transactions)) {
    return jsonResponse(
      { error: "Sisend peab sisaldama 'transactions' massiivi (vt parse-statement väljund)" },
      400,
    );
  }

  try {
    const result = normalizeStatement(raw);
    const profileBlobId = randomUUID();

    const resultWithId: NormalizedStatementWithId = { ...result, profile_blob_id: profileBlobId };

    try {
      const profilesStore = getStore("profiles");
      await profilesStore.setJSON(profileBlobId, resultWithId, {
        metadata: { created_at: new Date().toISOString() },
      });
    } catch (err) {
      console.error("JSON profiili blob salvestus ebaõnnestus:", err);
    }

    return jsonResponse(resultWithId, 200);
  } catch (err) {
    return jsonResponse({ error: "Normaliseerimine ebaõnnestus", detail: String(err) }, 500);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
