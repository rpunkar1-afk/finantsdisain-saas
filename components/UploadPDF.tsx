import { useState } from "react";
import type { ParseStatementResult } from "../api/parse-statement";
import type { NormalizedStatement } from "../lib/normalization";

interface UploadPDFProps {
  onComplete: (parsed: ParseStatementResult, normalized: NormalizedStatement) => void;
}

type UploadState = "idle" | "extracting" | "parsing" | "normalizing" | "done" | "error";

// Fikseerime maksimaalse teksti pikkuse, mis saadetakse Claude API-le — kaitseb
// ebamõistlikult pikkade dokumentide eest, ilma failisuuruse piiranguta iseenesest,
// kuna nüüd saadame ainult ekstraheeritud teksti, mitte algset PDF-i.
const MAX_TEXT_CHARS = 400_000;

export default function UploadPDF({ onComplete }: UploadPDFProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function extractTextFromPDF(file: File): Promise<string> {
    // Dünaamiline import — pdfjs-dist on brauseripoolne pakett, ei tohi
    // sattuda serveri (SSR) build'i sisse.
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

    return pageTexts.join("\n\n-- lehekülje eraldaja --\n\n");
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setState("extracting");

    try {
      let rawText = await extractTextFromPDF(file);
      if (!rawText || rawText.trim().length === 0) {
        throw new Error(
          "PDF-ist ei õnnestunud teksti eraldada. Fail võib olla skaneeritud pilt ilma tekstikihita.",
        );
      }
      if (rawText.length > MAX_TEXT_CHARS) {
        rawText = rawText.slice(0, MAX_TEXT_CHARS);
      }

      setState("parsing");
      const parseRes = await fetch("/api/parse-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, filename: file.name }),
      });
      if (!parseRes.ok) {
        const body = await parseRes.json().catch(() => ({}));
        throw new Error(body.error || `Parsimine ebaõnnestus (${parseRes.status})`);
      }
      const parsed: ParseStatementResult = await parseRes.json();

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
          {state === "parsing" && " — tuvastatakse tehinguid (Claude API)…"}
          {state === "normalizing" && " — kategoriseeritakse tehinguid…"}
          {state === "done" && " — töödeldud."}
        </p>
      )}

      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
