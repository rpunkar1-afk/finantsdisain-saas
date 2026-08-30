import { useState } from "react";
import type { ParseStatementResult } from "../api/parse-statement";
import type { NormalizedStatement } from "../lib/normalization";

interface UploadPDFProps {
  onComplete: (parsed: ParseStatementResult, normalized: NormalizedStatement) => void;
}

type UploadState = "idle" | "extracting" | "parsing" | "normalizing" | "done" | "error";

const PAGE_SEPARATOR = "\n\n-- lehekülje eraldaja --\n\n";

// Netlify Functions'i sünkroonne käivitus katkestatakse ~30s juures (kinnitatud
// live testimisel: 6.8MB PDF ühe Claude API kutsega -> Duration 30000ms -> 502).
// Lahendus: jaotame teksti tükkideks (chunk'ideks) ja teeme mitu kiiremat kutset,
// mitte üht suurt. CHUNK_CHAR_LIMIT on kalibreeritud konservatiivselt, et iga
// üksik kutse jääks kindlalt alla ajalimiidi.
const CHUNK_CHAR_LIMIT = 20_000;

export default function UploadPDF({ onComplete }: UploadPDFProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  async function extractPageTexts(file: File): Promise<string[]> {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pageTexts.push(pageText);
    }
    return pageTexts;
  }

  // Grupeerib leheküljed tükkideks, hoides iga tüki suuruse allpool CHUNK_CHAR_LIMIT.
  // Üksik leheküljetekst, mis üksinda ületab limiidi, moodustab siiski omaette tüki
  // (harv, kuid ei tohi kaotada andmeid).
  function chunkPages(pageTexts: string[]): string[] {
    const chunks: string[] = [];
    let current: string[] = [];
    let currentLen = 0;

    for (const pageText of pageTexts) {
      const addedLen = pageText.length + PAGE_SEPARATOR.length;
      if (current.length > 0 && currentLen + addedLen > CHUNK_CHAR_LIMIT) {
        chunks.push(current.join(PAGE_SEPARATOR));
        current = [];
        currentLen = 0;
      }
      current.push(pageText);
      currentLen += addedLen;
    }
    if (current.length > 0) {
      chunks.push(current.join(PAGE_SEPARATOR));
    }
    return chunks;
  }

  function mergeResults(results: ParseStatementResult[]): ParseStatementResult {
    const knownBank = results.find((r) => r.bank !== "unknown")?.bank ?? "unknown";
    const accountNumber = results.find((r) => r.account_number)?.account_number ?? null;
    const currency = results.find((r) => r.currency)?.currency ?? "EUR";
    const periodStarts = results.map((r) => r.period_start).filter((d): d is string => !!d);
    const periodEnds = results.map((r) => r.period_end).filter((d): d is string => !!d);

    return {
      bank: knownBank,
      account_number: accountNumber,
      currency,
      period_start: periodStarts.length > 0 ? periodStarts.sort()[0] : null,
      period_end: periodEnds.length > 0 ? periodEnds.sort().reverse()[0] : null,
      transactions: results.flatMap((r) => r.transactions),
      warnings: results.flatMap((r) => r.warnings),
      statement_blob_id: results[0]?.statement_blob_id ?? "",
    };
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setProgress(null);
    setState("extracting");

    try {
      const pageTexts = await extractPageTexts(file);
      const nonEmptyPages = pageTexts.filter((t) => t.trim().length > 0);
      if (nonEmptyPages.length === 0) {
        throw new Error(
          "PDF-ist ei õnnestunud teksti eraldada. Fail võib olla skaneeritud pilt ilma tekstikihita.",
        );
      }

      const chunks = chunkPages(pageTexts);

      setState("parsing");
      const chunkResults: ParseStatementResult[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setProgress({ current: i + 1, total: chunks.length });
        const parseRes = await fetch("/api/parse-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[i], filename: file.name }),
        });
        if (!parseRes.ok) {
          const body = await parseRes.json().catch(() => ({}));
          throw new Error(
            body.error || `Parsimine ebaõnnestus osal ${i + 1}/${chunks.length} (${parseRes.status})`,
          );
        }
        chunkResults.push((await parseRes.json()) as ParseStatementResult);
      }
      setProgress(null);

      const parsed = mergeResults(chunkResults);

      setState("normalizing");
      const normRes = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!normRes.ok) {
        const body = await normRes.json().catch(() => ({}));
        throw new Error(body.error || `Normaliseerimine ebaõnnestus (${normRes.status})`);
      }
      const normalized: NormalizedStatement = await normRes.json();

      setState("done");
      onComplete(parsed, normalized);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <div className="field">
        <label htmlFor="pdf-upload">Pangaväljavõte (PDF — Nordea, Swedbank, SEB)</label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          disabled={state === "extracting" || state === "parsing" || state === "normalizing"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {fileName && state !== "error" && (
        <p className="text-soft mono" style={{ fontSize: "0.85rem" }}>
          {fileName}
          {state === "extracting" && " — loetakse PDF-i tekst brauseris…"}
          {state === "parsing" &&
            (progress
              ? ` — tuvastatakse tehinguid (osa ${progress.current}/${progress.total})…`
              : " — tuvastatakse tehinguid (Claude API)…")}
          {state === "normalizing" && " — kategoriseeritakse tehinguid…"}
          {state === "done" && " — töödeldud."}
        </p>
      )}

      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
