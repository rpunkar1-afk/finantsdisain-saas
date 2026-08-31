import type { GeneratedDocument } from "../lib/documents/generate";
import type { DocumentTypeConfig } from "../lib/documents/registry";

interface DocumentResultProps {
  document: GeneratedDocument;
  config: DocumentTypeConfig;
  onReset?: () => void;
}

export default function DocumentResult({ document, config, onReset }: DocumentResultProps) {
  return (
    <>
      <div className="ledger-rule" />
      {document.sections.map((s) => (
        <div key={s.id} className="card">
          <h2>{s.heading}</h2>
          <p>{s.narrative}</p>
        </div>
      ))}
      <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <a href={`/api/document-${config.outputFormat}?id=${document.document_id}`} className="button">
          Laadi {config.outputFormat.toUpperCase()}
        </a>
        {onReset && (
          <button className="button secondary" onClick={onReset}>
            Genereeri uuesti
          </button>
        )}
      </div>
    </>
  );
}
