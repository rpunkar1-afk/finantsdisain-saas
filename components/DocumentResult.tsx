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
      {document.analysis && (
        <div className="card">
          <h2>
            Skoor {document.analysis.score}/100 — riskitase: {document.analysis.risk_level}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <tbody>
              {document.analysis.breakdown.map((b) => (
                <tr key={b.id}>
                  <td style={{ padding: "0.3rem 0" }}>{b.label}</td>
                  <td style={{ padding: "0.3rem 0.6rem" }}>{b.bandLabel}</td>
                  <td style={{ padding: "0.3rem 0", textAlign: "right" }}>
                    {b.points}/{b.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
