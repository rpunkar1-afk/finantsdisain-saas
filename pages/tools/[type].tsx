import { useState } from "react";
import { useRouter } from "next/router";
import { DOCUMENT_TYPES, getDocumentType } from "../../lib/documents/registry";
import type { GeneratedDocument } from "../../lib/documents/generate";
import DocumentResult from "../../components/DocumentResult";

export default function ToolPage() {
  const router = useRouter();
  const typeId = typeof router.query.type === "string" ? router.query.type : "";
  const config = getDocumentType(typeId);

  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<GeneratedDocument | null>(null);

  if (!router.isReady) return null;

  if (!config) {
    return (
      <div className="page">
        <div className="error-box">Tundmatu tööriist: &quot;{typeId}&quot;.</div>
      </div>
    );
  }

  function setField(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setDocument(null);

    const input: Record<string, string | number> = {};
    for (const field of config!.fields) {
      const raw = values[field.id] ?? field.defaultValue ?? "";
      input[field.id] = field.type === "number" ? Number(raw || 0) : raw;
    }

    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: config!.id, input }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Genereerimine ebaõnnestus (${res.status})`);
      }
      const data: GeneratedDocument = await res.json();
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="eyebrow">{config.audience}</div>
      <h1>{config.title}</h1>
      <p className="text-soft">{config.description}</p>

      {!document && (
        <form onSubmit={handleSubmit} className="card">
          {config.fields.map((field) => (
            <div className="field" key={field.id}>
              <label htmlFor={field.id}>
                {field.label}
                {field.unit ? ` (${field.unit})` : ""}
                {field.required ? " *" : ""}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={field.id}
                  rows={4}
                  placeholder={field.placeholder}
                  value={values[field.id] ?? ""}
                  onChange={(e) => setField(field.id, e.target.value)}
                  required={field.required}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.95rem",
                    padding: "0.55rem 0.7rem",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius)",
                    background: "var(--color-surface-2)",
                    color: "var(--color-ink)",
                    resize: "vertical",
                  }}
                />
              ) : (
                <input
                  id={field.id}
                  type={field.type === "number" ? "number" : "text"}
                  placeholder={field.placeholder}
                  value={values[field.id] ?? field.defaultValue ?? ""}
                  onChange={(e) => setField(field.id, e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          ))}
          <button type="submit" className="button" disabled={loading}>
            {loading ? "Genereerin…" : `Genereeri ${config.title.toLowerCase()}`}
          </button>
        </form>
      )}

      {error && <div className="error-box">{error}</div>}

      {document && (
        <DocumentResult document={document} config={config} onReset={() => setDocument(null)} />
      )}
    </div>
  );
}

export async function getStaticPaths() {
  return {
    paths: DOCUMENT_TYPES.map((t) => ({ params: { type: t.id } })),
    fallback: false,
  };
}

export async function getStaticProps() {
  return { props: {} };
}
