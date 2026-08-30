"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/parse-statement/index.ts
var index_exports = {};
__export(index_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_pdf_parse = require("pdf-parse");
var import_sdk = __toESM(require("@anthropic-ai/sdk"));
var config = {
  path: "/api/parse-statement"
};
var SUPPORTED_BANKS = ["nordea", "swedbank", "seb"];
var EXTRACTION_SYSTEM_PROMPT = `Sa oled pangav\xE4ljav\xF5tete struktureeritud andmete ekstraheerija.
Sisend on Eesti panga (Nordea, Swedbank v\xF5i SEB) kontov\xE4ljav\xF5tte toorest PDF-tekstist.
Tuvasta pank teksti formaadi/p\xE4ise j\xE4rgi.

Tagasta AINULT JSON, ilma preambulita, ilma markdown-koodiplokkideta, t\xE4pselt selle skeemi j\xE4rgi:
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
- amount: positiivne sissetuleku korral, negatiivne v\xE4ljamineku korral
- date: alati ISO 8601 formaadis (YYYY-MM-DD), teisenda panga formaadist (nt DD.MM.YYYY)
- Kui panka ei tuvastata, kasuta "unknown" ja lisa warnings kirje
- Kui v\xE4ljad puuduvad, kasuta null (mitte t\xFChja stringi)
- Kui tekst on liiga h\xE4gune/mittet\xE4ielik, ekstraheeri mis v\xF5imalik ja lisa warnings kirje probleemi kohta
- \xC4ra leiuta tehinguid, mida tekstis ei ole
- Vasta ainult JSON objektiga, mitte millegi muuga`;
async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "Server misconfiguration: ANTHROPIC_API_KEY puudub" },
      500
    );
  }
  let fileBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return jsonResponse({ error: "V\xE4li 'file' puudub v\xF5i pole PDF" }, 400);
    }
    if (file.type !== "application/pdf") {
      return jsonResponse({ error: "Ainult PDF failid on toetatud" }, 400);
    }
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    return jsonResponse(
      { error: "Faili lugemine eba\xF5nnestus", detail: String(err) },
      400
    );
  }
  let rawText;
  const parser = new import_pdf_parse.PDFParse({ data: fileBuffer });
  try {
    const parsed = await parser.getText();
    rawText = parsed.text;
    if (!rawText || rawText.trim().length === 0) {
      return jsonResponse(
        {
          error: "PDF-ist ei \xF5nnestunud teksti eraldada (v\xF5ib olla skaneeritud pilt, mitte tekst-PDF)"
        },
        422
      );
    }
  } catch (err) {
    return jsonResponse(
      { error: "PDF parsimine eba\xF5nnestus", detail: String(err) },
      422
    );
  } finally {
    await parser.destroy();
  }
  const anthropic = new import_sdk.default({ apiKey });
  let result;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8e3,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Pangav\xE4ljav\xF5tte toores tekst:

${rawText}`
        }
      ]
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return jsonResponse(
        { error: "Claude API ei tagastanud tekstivastust" },
        502
      );
    }
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    return jsonResponse(
      { error: "Struktureeritud andmete ekstraheerimine eba\xF5nnestus", detail: String(err) },
      502
    );
  }
  if (!SUPPORTED_BANKS.includes(result.bank)) {
    result.warnings = result.warnings || [];
    result.warnings.push(
      `Panka ei tuvastatud toetatud loendist (${SUPPORTED_BANKS.join(", ")}); tuvastatud v\xE4\xE4rtus: ${result.bank}`
    );
  }
  return jsonResponse(result, 200);
}
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpL3BhcnNlLXN0YXRlbWVudC9pbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gTmV0bGlmeSBGdW5jdGlvbiAodjIsIFdlYiBBUEkgaGFuZGxlcilcbi8vIFNhbW0gMjogUERGIHBhcnNlclxuLy8gVm9vZzogUERGIChtdWx0aXBhcnQvZm9ybS1kYXRhKSAtPiB0ZWtzdGlla3N0cmFrdHNpb29uIChwZGYtcGFyc2UpIC0+IENsYXVkZSBBUEkgLT4gc3RydWt0dXJlZXJpdHVkIEpTT05cbi8vIFRvZXRhYjogTm9yZGVhLCBTd2VkYmFuaywgU0VCIHBhbmdhdlx1MDBFNGxqYXZcdTAwRjV0dGVkXG5cbmltcG9ydCB7IFBERlBhcnNlIH0gZnJvbSBcInBkZi1wYXJzZVwiO1xuaW1wb3J0IEFudGhyb3BpYyBmcm9tIFwiQGFudGhyb3BpYy1haS9zZGtcIjtcblxuZXhwb3J0IGNvbnN0IGNvbmZpZyA9IHtcbiAgcGF0aDogXCIvYXBpL3BhcnNlLXN0YXRlbWVudFwiLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRUcmFuc2FjdGlvbiB7XG4gIGRhdGU6IHN0cmluZzsgLy8gSVNPIDg2MDEgKFlZWVktTU0tREQpXG4gIGFtb3VudDogbnVtYmVyOyAvLyBwb3NpdGlpdm5lID0gc2lzc2V0dWxlaywgbmVnYXRpaXZuZSA9IHZcdTAwRTRsamFtaW5la1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBiYWxhbmNlOiBudW1iZXIgfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlU3RhdGVtZW50UmVzdWx0IHtcbiAgYmFuazogXCJub3JkZWFcIiB8IFwic3dlZGJhbmtcIiB8IFwic2ViXCIgfCBcInVua25vd25cIjtcbiAgYWNjb3VudF9udW1iZXI6IHN0cmluZyB8IG51bGw7XG4gIGN1cnJlbmN5OiBzdHJpbmc7XG4gIHBlcmlvZF9zdGFydDogc3RyaW5nIHwgbnVsbDtcbiAgcGVyaW9kX2VuZDogc3RyaW5nIHwgbnVsbDtcbiAgdHJhbnNhY3Rpb25zOiBQYXJzZWRUcmFuc2FjdGlvbltdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbmNvbnN0IFNVUFBPUlRFRF9CQU5LUyA9IFtcIm5vcmRlYVwiLCBcInN3ZWRiYW5rXCIsIFwic2ViXCJdIGFzIGNvbnN0O1xuXG5jb25zdCBFWFRSQUNUSU9OX1NZU1RFTV9QUk9NUFQgPSBgU2Egb2xlZCBwYW5nYXZcdTAwRTRsamF2XHUwMEY1dGV0ZSBzdHJ1a3R1cmVlcml0dWQgYW5kbWV0ZSBla3N0cmFoZWVyaWphLlxuU2lzZW5kIG9uIEVlc3RpIHBhbmdhIChOb3JkZWEsIFN3ZWRiYW5rIHZcdTAwRjVpIFNFQikga29udG92XHUwMEU0bGphdlx1MDBGNXR0ZSB0b29yZXN0IFBERi10ZWtzdGlzdC5cblR1dmFzdGEgcGFuayB0ZWtzdGkgZm9ybWFhZGkvcFx1MDBFNGlzZSBqXHUwMEU0cmdpLlxuXG5UYWdhc3RhIEFJTlVMVCBKU09OLCBpbG1hIHByZWFtYnVsaXRhLCBpbG1hIG1hcmtkb3duLWtvb2RpcGxva2tpZGV0YSwgdFx1MDBFNHBzZWx0IHNlbGxlIHNrZWVtaSBqXHUwMEU0cmdpOlxue1xuICBcImJhbmtcIjogXCJub3JkZWFcIiB8IFwic3dlZGJhbmtcIiB8IFwic2ViXCIgfCBcInVua25vd25cIixcbiAgXCJhY2NvdW50X251bWJlclwiOiBzdHJpbmcgfCBudWxsLFxuICBcImN1cnJlbmN5XCI6IHN0cmluZyxcbiAgXCJwZXJpb2Rfc3RhcnRcIjogXCJZWVlZLU1NLUREXCIgfCBudWxsLFxuICBcInBlcmlvZF9lbmRcIjogXCJZWVlZLU1NLUREXCIgfCBudWxsLFxuICBcInRyYW5zYWN0aW9uc1wiOiBbXG4gICAgeyBcImRhdGVcIjogXCJZWVlZLU1NLUREXCIsIFwiYW1vdW50XCI6IG51bWJlciwgXCJkZXNjcmlwdGlvblwiOiBzdHJpbmcsIFwiYmFsYW5jZVwiOiBudW1iZXIgfCBudWxsIH1cbiAgXSxcbiAgXCJ3YXJuaW5nc1wiOiBzdHJpbmdbXVxufVxuXG5SZWVnbGlkOlxuLSBhbW91bnQ6IHBvc2l0aWl2bmUgc2lzc2V0dWxla3Uga29ycmFsLCBuZWdhdGlpdm5lIHZcdTAwRTRsamFtaW5la3Uga29ycmFsXG4tIGRhdGU6IGFsYXRpIElTTyA4NjAxIGZvcm1hYWRpcyAoWVlZWS1NTS1ERCksIHRlaXNlbmRhIHBhbmdhIGZvcm1hYWRpc3QgKG50IERELk1NLllZWVkpXG4tIEt1aSBwYW5rYSBlaSB0dXZhc3RhdGEsIGthc3V0YSBcInVua25vd25cIiBqYSBsaXNhIHdhcm5pbmdzIGtpcmplXG4tIEt1aSB2XHUwMEU0bGphZCBwdXVkdXZhZCwga2FzdXRhIG51bGwgKG1pdHRlIHRcdTAwRkNoamEgc3RyaW5naSlcbi0gS3VpIHRla3N0IG9uIGxpaWdhIGhcdTAwRTRndW5lL21pdHRldFx1MDBFNGllbGlrLCBla3N0cmFoZWVyaSBtaXMgdlx1MDBGNWltYWxpayBqYSBsaXNhIHdhcm5pbmdzIGtpcmplIHByb2JsZWVtaSBrb2h0YVxuLSBcdTAwQzRyYSBsZWl1dGEgdGVoaW5ndWlkLCBtaWRhIHRla3N0aXMgZWkgb2xlXG4tIFZhc3RhIGFpbnVsdCBKU09OIG9iamVrdGlnYSwgbWl0dGUgbWlsbGVnaSBtdXVnYWA7XG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgNDA1KTtcbiAgfVxuXG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICB7IGVycm9yOiBcIlNlcnZlciBtaXNjb25maWd1cmF0aW9uOiBBTlRIUk9QSUNfQVBJX0tFWSBwdXVkdWJcIiB9LFxuICAgICAgNTAwLFxuICAgICk7XG4gIH1cblxuICBsZXQgZmlsZUJ1ZmZlcjogQnVmZmVyO1xuICB0cnkge1xuICAgIGNvbnN0IGZvcm1EYXRhID0gYXdhaXQgcmVxLmZvcm1EYXRhKCk7XG4gICAgY29uc3QgZmlsZSA9IGZvcm1EYXRhLmdldChcImZpbGVcIik7XG4gICAgaWYgKCFmaWxlIHx8ICEoZmlsZSBpbnN0YW5jZW9mIEZpbGUpKSB7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiVlx1MDBFNGxpICdmaWxlJyBwdXVkdWIgdlx1MDBGNWkgcG9sZSBQREZcIiB9LCA0MDApO1xuICAgIH1cbiAgICBpZiAoZmlsZS50eXBlICE9PSBcImFwcGxpY2F0aW9uL3BkZlwiKSB7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiQWludWx0IFBERiBmYWlsaWQgb24gdG9ldGF0dWRcIiB9LCA0MDApO1xuICAgIH1cbiAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IGZpbGUuYXJyYXlCdWZmZXIoKTtcbiAgICBmaWxlQnVmZmVyID0gQnVmZmVyLmZyb20oYXJyYXlCdWZmZXIpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAgeyBlcnJvcjogXCJGYWlsaSBsdWdlbWluZSBlYmFcdTAwRjVubmVzdHVzXCIsIGRldGFpbDogU3RyaW5nKGVycikgfSxcbiAgICAgIDQwMCxcbiAgICApO1xuICB9XG5cbiAgbGV0IHJhd1RleHQ6IHN0cmluZztcbiAgY29uc3QgcGFyc2VyID0gbmV3IFBERlBhcnNlKHsgZGF0YTogZmlsZUJ1ZmZlciB9KTtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBhd2FpdCBwYXJzZXIuZ2V0VGV4dCgpO1xuICAgIHJhd1RleHQgPSBwYXJzZWQudGV4dDtcbiAgICBpZiAoIXJhd1RleHQgfHwgcmF3VGV4dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAgICB7XG4gICAgICAgICAgZXJyb3I6XG4gICAgICAgICAgICBcIlBERi1pc3QgZWkgXHUwMEY1bm5lc3R1bnVkIHRla3N0aSBlcmFsZGFkYSAodlx1MDBGNWliIG9sbGEgc2thbmVlcml0dWQgcGlsdCwgbWl0dGUgdGVrc3QtUERGKVwiLFxuICAgICAgICB9LFxuICAgICAgICA0MjIsXG4gICAgICApO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgIHsgZXJyb3I6IFwiUERGIHBhcnNpbWluZSBlYmFcdTAwRjVubmVzdHVzXCIsIGRldGFpbDogU3RyaW5nKGVycikgfSxcbiAgICAgIDQyMixcbiAgICApO1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IHBhcnNlci5kZXN0cm95KCk7XG4gIH1cblxuICBjb25zdCBhbnRocm9waWMgPSBuZXcgQW50aHJvcGljKHsgYXBpS2V5IH0pO1xuXG4gIGxldCByZXN1bHQ6IFBhcnNlU3RhdGVtZW50UmVzdWx0O1xuICB0cnkge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBhbnRocm9waWMubWVzc2FnZXMuY3JlYXRlKHtcbiAgICAgIG1vZGVsOiBcImNsYXVkZS1zb25uZXQtNC02XCIsXG4gICAgICBtYXhfdG9rZW5zOiA4MDAwLFxuICAgICAgc3lzdGVtOiBFWFRSQUNUSU9OX1NZU1RFTV9QUk9NUFQsXG4gICAgICBtZXNzYWdlczogW1xuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgICAgY29udGVudDogYFBhbmdhdlx1MDBFNGxqYXZcdTAwRjV0dGUgdG9vcmVzIHRla3N0OlxcblxcbiR7cmF3VGV4dH1gLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHRleHRCbG9jayA9IG1lc3NhZ2UuY29udGVudC5maW5kKChiKSA9PiBiLnR5cGUgPT09IFwidGV4dFwiKTtcbiAgICBpZiAoIXRleHRCbG9jayB8fCB0ZXh0QmxvY2sudHlwZSAhPT0gXCJ0ZXh0XCIpIHtcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHsgZXJyb3I6IFwiQ2xhdWRlIEFQSSBlaSB0YWdhc3RhbnVkIHRla3N0aXZhc3R1c3RcIiB9LFxuICAgICAgICA1MDIsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGNsZWFuZWQgPSB0ZXh0QmxvY2sudGV4dFxuICAgICAgLnRyaW0oKVxuICAgICAgLnJlcGxhY2UoL15gYGBqc29uXFxzKi9pLCBcIlwiKVxuICAgICAgLnJlcGxhY2UoL2BgYCQvaSwgXCJcIilcbiAgICAgIC50cmltKCk7XG5cbiAgICByZXN1bHQgPSBKU09OLnBhcnNlKGNsZWFuZWQpIGFzIFBhcnNlU3RhdGVtZW50UmVzdWx0O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAgeyBlcnJvcjogXCJTdHJ1a3R1cmVlcml0dWQgYW5kbWV0ZSBla3N0cmFoZWVyaW1pbmUgZWJhXHUwMEY1bm5lc3R1c1wiLCBkZXRhaWw6IFN0cmluZyhlcnIpIH0sXG4gICAgICA1MDIsXG4gICAgKTtcbiAgfVxuXG4gIGlmICghU1VQUE9SVEVEX0JBTktTLmluY2x1ZGVzKHJlc3VsdC5iYW5rIGFzIHR5cGVvZiBTVVBQT1JURURfQkFOS1NbbnVtYmVyXSkpIHtcbiAgICByZXN1bHQud2FybmluZ3MgPSByZXN1bHQud2FybmluZ3MgfHwgW107XG4gICAgcmVzdWx0Lndhcm5pbmdzLnB1c2goXG4gICAgICBgUGFua2EgZWkgdHV2YXN0YXR1ZCB0b2V0YXR1ZCBsb2VuZGlzdCAoJHtTVVBQT1JURURfQkFOS1Muam9pbihcIiwgXCIpfSk7IHR1dmFzdGF0dWQgdlx1MDBFNFx1MDBFNHJ0dXM6ICR7cmVzdWx0LmJhbmt9YCxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGpzb25SZXNwb25zZShyZXN1bHQsIDIwMCk7XG59XG5cbmZ1bmN0aW9uIGpzb25SZXNwb25zZShib2R5OiB1bmtub3duLCBzdGF0dXM6IG51bWJlcik6IFJlc3BvbnNlIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShib2R5KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gIH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBS0EsdUJBQXlCO0FBQ3pCLGlCQUFzQjtBQUVmLElBQU0sU0FBUztBQUFBLEVBQ3BCLE1BQU07QUFDUjtBQW1CQSxJQUFNLGtCQUFrQixDQUFDLFVBQVUsWUFBWSxLQUFLO0FBRXBELElBQU0sMkJBQTJCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMEJqQyxlQUFPLFFBQStCLEtBQWlDO0FBQ3JFLE1BQUksSUFBSSxXQUFXLFFBQVE7QUFDekIsV0FBTyxhQUFhLEVBQUUsT0FBTyxxQkFBcUIsR0FBRyxHQUFHO0FBQUEsRUFDMUQ7QUFFQSxRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLE1BQUksQ0FBQyxRQUFRO0FBQ1gsV0FBTztBQUFBLE1BQ0wsRUFBRSxPQUFPLG9EQUFvRDtBQUFBLE1BQzdEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxNQUFJO0FBQ0osTUFBSTtBQUNGLFVBQU0sV0FBVyxNQUFNLElBQUksU0FBUztBQUNwQyxVQUFNLE9BQU8sU0FBUyxJQUFJLE1BQU07QUFDaEMsUUFBSSxDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsT0FBTztBQUNwQyxhQUFPLGFBQWEsRUFBRSxPQUFPLHdDQUFrQyxHQUFHLEdBQUc7QUFBQSxJQUN2RTtBQUNBLFFBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNuQyxhQUFPLGFBQWEsRUFBRSxPQUFPLGdDQUFnQyxHQUFHLEdBQUc7QUFBQSxJQUNyRTtBQUNBLFVBQU0sY0FBYyxNQUFNLEtBQUssWUFBWTtBQUMzQyxpQkFBYSxPQUFPLEtBQUssV0FBVztBQUFBLEVBQ3RDLFNBQVMsS0FBSztBQUNaLFdBQU87QUFBQSxNQUNMLEVBQUUsT0FBTyxpQ0FBOEIsUUFBUSxPQUFPLEdBQUcsRUFBRTtBQUFBLE1BQzNEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxNQUFJO0FBQ0osUUFBTSxTQUFTLElBQUksMEJBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNoRCxNQUFJO0FBQ0YsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRO0FBQ3BDLGNBQVUsT0FBTztBQUNqQixRQUFJLENBQUMsV0FBVyxRQUFRLEtBQUssRUFBRSxXQUFXLEdBQUc7QUFDM0MsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE9BQ0U7QUFBQSxRQUNKO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEtBQUs7QUFDWixXQUFPO0FBQUEsTUFDTCxFQUFFLE9BQU8sZ0NBQTZCLFFBQVEsT0FBTyxHQUFHLEVBQUU7QUFBQSxNQUMxRDtBQUFBLElBQ0Y7QUFBQSxFQUNGLFVBQUU7QUFDQSxVQUFNLE9BQU8sUUFBUTtBQUFBLEVBQ3ZCO0FBRUEsUUFBTSxZQUFZLElBQUksV0FBQUEsUUFBVSxFQUFFLE9BQU8sQ0FBQztBQUUxQyxNQUFJO0FBQ0osTUFBSTtBQUNGLFVBQU0sVUFBVSxNQUFNLFVBQVUsU0FBUyxPQUFPO0FBQUEsTUFDOUMsT0FBTztBQUFBLE1BQ1AsWUFBWTtBQUFBLE1BQ1osUUFBUTtBQUFBLE1BQ1IsVUFBVTtBQUFBLFFBQ1I7QUFBQSxVQUNFLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQTtBQUFBLEVBQW9DLE9BQU87QUFBQSxRQUN0RDtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFFRCxVQUFNLFlBQVksUUFBUSxRQUFRLEtBQUssQ0FBQyxNQUFNLEVBQUUsU0FBUyxNQUFNO0FBQy9ELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRO0FBQzNDLGFBQU87QUFBQSxRQUNMLEVBQUUsT0FBTyx5Q0FBeUM7QUFBQSxRQUNsRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUEsVUFBTSxVQUFVLFVBQVUsS0FDdkIsS0FBSyxFQUNMLFFBQVEsZ0JBQWdCLEVBQUUsRUFDMUIsUUFBUSxTQUFTLEVBQUUsRUFDbkIsS0FBSztBQUVSLGFBQVMsS0FBSyxNQUFNLE9BQU87QUFBQSxFQUM3QixTQUFTLEtBQUs7QUFDWixXQUFPO0FBQUEsTUFDTCxFQUFFLE9BQU8sMERBQXVELFFBQVEsT0FBTyxHQUFHLEVBQUU7QUFBQSxNQUNwRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsTUFBSSxDQUFDLGdCQUFnQixTQUFTLE9BQU8sSUFBc0MsR0FBRztBQUM1RSxXQUFPLFdBQVcsT0FBTyxZQUFZLENBQUM7QUFDdEMsV0FBTyxTQUFTO0FBQUEsTUFDZCwwQ0FBMEMsZ0JBQWdCLEtBQUssSUFBSSxDQUFDLGdDQUEwQixPQUFPLElBQUk7QUFBQSxJQUMzRztBQUFBLEVBQ0Y7QUFFQSxTQUFPLGFBQWEsUUFBUSxHQUFHO0FBQ2pDO0FBRUEsU0FBUyxhQUFhLE1BQWUsUUFBMEI7QUFDN0QsU0FBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLElBQUksR0FBRztBQUFBLElBQ3hDO0FBQUEsSUFDQSxTQUFTLEVBQUUsZ0JBQWdCLG1CQUFtQjtBQUFBLEVBQ2hELENBQUM7QUFDSDsiLAogICJuYW1lcyI6IFsiQW50aHJvcGljIl0KfQo=
