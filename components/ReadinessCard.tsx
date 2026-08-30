import type { KYReadinessResult } from "../api/ky-readiness";

interface ReadinessCardProps {
  result: KYReadinessResult;
}

export default function ReadinessCard({ result }: ReadinessCardProps) {
  return (
    <div className="card">
      <div className="score-display">
        <span className={`badge risk-${result.risk_level}`} style={{ fontSize: "0.95rem", padding: "0.4rem 0.9rem" }}>
          {result.overall_ready ? "Taotlusvalmis" : "Ei ole veel taotlusvalmis"}
        </span>
      </div>
      <p className="text-soft mono" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
        Finantsskoor: {result.score} / 100 ({result.risk_level})
      </p>

      <div className="ledger-rule" />

      <h3>Kontrollnimekiri</h3>
      {result.checklist.map((item) => (
        <div className="breakdown-row" key={item.id}>
          <span>
            {item.label}
            <br />
            <span className="text-soft" style={{ fontSize: "0.8rem" }}>
              {item.detail}
            </span>
          </span>
          <span className={`badge status-${item.status}`}>{item.status}</span>
        </div>
      ))}

      <div className="ledger-rule" />

      <h3>Tee KredEx/EIS taotluseni</h3>
      <ol className="numbered-steps">
        {result.next_steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
