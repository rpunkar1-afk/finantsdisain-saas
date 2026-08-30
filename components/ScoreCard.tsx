import type { ScoringResult } from "../lib/scoring";

interface ScoreCardProps {
  result: ScoringResult;
}

export default function ScoreCard({ result }: ScoreCardProps) {
  return (
    <div className="card">
      <div className="score-display">
        <span className="score-number">{result.score}</span>
        <span className="score-max">/ 100</span>
        <span className={`badge risk-${result.risk_level}`}>{result.risk_level}</span>
      </div>

      <div className="ledger-rule" />

      <h3>Kriteeriumid</h3>
      {result.breakdown.map((b) => (
        <div className="breakdown-row" key={b.id}>
          <span>
            {b.label}
            <br />
            <span className="text-soft" style={{ fontSize: "0.8rem" }}>
              {b.bandLabel}
            </span>
          </span>
          <span className="points">
            {b.points} / {b.weight}
          </span>
        </div>
      ))}

      {result.strengths.length > 0 && (
        <>
          <div className="ledger-rule" />
          <h3>Tugevused</h3>
          <ul>
            {result.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}

      {result.weaknesses.length > 0 && (
        <>
          <div className="ledger-rule" />
          <h3>Nõrkused</h3>
          <ul>
            {result.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
