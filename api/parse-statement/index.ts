// Netlify Function (v2, Web API handler)
// Samm 2: PDF parser
// Voog: PDF (multipart/form-data) -> tekstiekstraktsioon (pdf-parse) -> Claude API -> struktureeritud JSON
// Toetab: Nordea, Swedbank, SEB pangaväljavõtted

import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

export const config = {
  path: "/api/parse-statement",
};

export interface ParsedTransaction {
  date: string; // ISO 8601 (YYYY-MM-DD)
  amount: number; // positiivne = sissetulek, negatiivne = väljaminek
  description: string;
  balance: number | null;
}

export interface ParseStatementResult {
  bank: "nordea" | "swedbank" | "seb" | "unknown";
  account_number: string | null;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  transactions: ParsedTransaction[];
  warnings: string[];
  statement_blob_id: string; // Samm 12: viide salvestatud originaal-PDF-ile
}

const SUPPORTED_BANKS = ["nordea", "swedbank", "seb"] as const;

const EXTRACTION_SYSTEM_PROMPT = `Sa oled pangaväljavõtete struktureeritud andmete ekstraheerija.
Sisend on Eesti panga (Nordea, Swedbank või SEB) kontoväljavõtte toorest PDF-tekstist.
Tuvasta pank teksti formaadi/päise järgi.

Tagasta AINULT JSON, ilma preambulita, ilma markdown-koodiplokkideta, täpselt selle skeemi järgi:
{
  "bank": "nordea" | "swedbank" | "seb" | "unknown",
  "account_number": string | null,
  "currency": string,
  "period_start": "YYYY-MM-DD" | null,
  "period_end": "YYYY-MM-DD" | null,
  "transactions": [
    { "date": "YYYY-MM-DD", "amount": number, "description": string, "balance": number | null }
  ],
  "warnings": string[]
}

Reeglid:
- amount: positiivne sissetuleku korral, negatiivne väljamineku korral
- date: alati ISO 8601 formaadis (YYYY-MM-DD), teisenda panga formaadist (nt DD.MM.YYYY)
- Kui panka ei tuvastata, kasuta "unknown" ja lisa warnings kirje
- Kui väljad puuduvad, kasuta null (mitte tühja stringi)
- Kui tekst on liiga hägune/mittetäielik, ekstraheeri mis võimalik ja lisa warnings kirje probleemi kohta
- Ära leiuta tehinguid, mida tekstis ei ole
- Vasta ainult JSON objektiga, mitte millegi muuga`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const blobId = url.searchParams.get("blob_id");
    if (!blobId) {
      return jsonResponse({ error: "Query param 'blob_id' on kohustuslik GET päringul" }, 400);
    }
    try {
      const statementsStore = getStore("statements");
      const data = await statementsStore.get(blobId, { type: "arrayBuffer" });
      if (!data) {
        return jsonResponse({ error: `PDF-i id="${blobId}" ei leitud` }, 404);
      }
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    } catch (err) {
      return jsonResponse({ error: "PDF taastamine ebaõnnestus", detail: String(err) }, 500);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "Server misconfiguration: ANTHROPIC_API_KEY puudub" },
      500,
    );
  }

  let fileBuffer: Buffer;
  let originalFileName = "statement.pdf";
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return jsonResponse({ error: "Väli 'file' puudub või pole PDF" }, 400);
    }
    if (file.type !== "application/pdf") {
      return jsonResponse({ error: "Ainult PDF failid on toetatud" }, 400);
    }
    originalFileName = file.name || originalFileName;
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    return jsonResponse(
      { error: "Faili lugemine ebaõnnestus", detail: String(err) },
      400,
    );
  }

  // Samm 12: salvesta originaal-PDF Netlify Blobs-i, enne töötlemist
  const statementBlobId = randomUUID();
  try {
    const statementsStore = getStore("statements");
    await statementsStore.set(statementBlobId, fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer, {
      metadata: { filename: originalFileName, uploaded_at: new Date().toISOString() },
    });
  } catch (err) {
    // Salvestuse ebaõnnestumine ei tohi blokeerida analüüsi — logime ja jätkame ilma blob_id viiteta
    console.error("PDF blob salvestus ebaõnnestus:", err);
  }

  let rawText: string;
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const parsed = await parser.getText();
    rawText = parsed.text;
    if (!rawText || rawText.trim().length === 0) {
      return jsonResponse(
        {
          error:
            "PDF-ist ei õnnestunud teksti eraldada (võib olla skaneeritud pilt, mitte tekst-PDF)",
        },
        422,
      );
    }
  } catch (err) {
    return jsonResponse(
      { error: "PDF parsimine ebaõnnestus", detail: String(err) },
      422,
    );
  } finally {
    await parser.destroy();
  }

  const anthropic = new Anthropic({ apiKey });

  let result: ParseStatementResult;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Pangaväljavõtte toores tekst:\n\n${rawText}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return jsonResponse(
        { error: "Claude API ei tagastanud tekstivastust" },
        502,
      );
    }

    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    result = JSON.parse(cleaned) as ParseStatementResult;
    result.statement_blob_id = statementBlobId;
  } catch (err) {
    return jsonResponse(
      { error: "Struktureeritud andmete ekstraheerimine ebaõnnestus", detail: String(err) },
      502,
    );
  }

  if (!SUPPORTED_BANKS.includes(result.bank as typeof SUPPORTED_BANKS[number])) {
    result.warnings = result.warnings || [];
    result.warnings.push(
      `Panka ei tuvastatud toetatud loendist (${SUPPORTED_BANKS.join(", ")}); tuvastatud väärtus: ${result.bank}`,
    );
  }

  return jsonResponse(result, 200);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
