import { useState } from "react";
import type { ParseStatementResult } from "../api/parse-statement";
import type { NormalizedStatement } from "../lib/normalization";

interface UploadPDFProps {
  onComplete: (parsed: ParseStatementResult, normalized: NormalizedStatement) => void;
}

type UploadState = "idle" | "parsing" | "normalizing" | "done" | "error";

export default function UploadPDF({ onComplete }: UploadPDFProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setState("parsing");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const parseRes = await fetch("/api/parse-statement", { method: "POST", body: formData });
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
          disabled={state === "parsing" || state === "normalizing"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {fileName && state !== "error" && (
        <p className="text-soft mono" style={{ fontSize: "0.85rem" }}>
          {fileName}
          {state === "parsing" && " — loetakse PDF-i ja tuvastatakse tehinguid…"}
          {state === "normalizing" && " — kategoriseeritakse tehinguid…"}
          {state === "done" && " — töödeldud."}
        </p>
      )}

      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
