import { useEffect, useState } from "react";
import type { GrantProgram, GrantStatus, GrantSegment } from "../api/grants";

export default function Grants() {
  const [grants, setGrants] = useState<GrantProgram[]>([]);
  const [status, setStatus] = useState<GrantStatus | "">("");
  const [segment, setSegment] = useState<GrantSegment | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (segment) params.set("segment", segment);

    fetch(`/api/grants?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Toetuste laadimine ebaõnnestus (${res.status})`);
        return res.json();
      })
      .then((data) => setGrants(data.grants))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [status, segment]);

  return (
    <div className="page">
      <div className="eyebrow">Toetuste radar</div>
      <h1>Praegu kättesaadavad toetused</h1>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="field">
          <label>Staatus</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as GrantStatus | "")}>
            <option value="">Kõik</option>
            <option value="open">Avatud</option>
            <option value="upcoming">Tulevane</option>
            <option value="closed">Suletud</option>
          </select>
        </div>
        <div className="field">
          <label>Segment</label>
          <select value={segment} onChange={(e) => setSegment(e.target.value as GrantSegment | "")}>
            <option value="">Kõik</option>
            <option value="vke">VKE</option>
            <option value="ky">KÜ</option>
          </select>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <p className="text-soft">Laen…</p>}

      {!loading &&
        grants.map((g) => (
          <div className="card" key={g.id}>
            <div className="score-display" style={{ justifyContent: "space-between", width: "100%" }}>
              <h3 style={{ margin: 0 }}>{g.name}</h3>
              <span className={`badge status-${g.status === "open" ? "ok" : g.status === "upcoming" ? "warning" : "blocked"}`}>
                {g.status}
              </span>
            </div>
            <p className="text-soft" style={{ fontSize: "0.9rem" }}>
              {g.provider} · {g.target_segment.toUpperCase()}
            </p>
            <p>{g.description}</p>
            <p className="mono" style={{ fontSize: "0.85rem" }}>
              {g.funding_rate}
              {g.max_amount_eur ? ` · kuni ${g.max_amount_eur.toLocaleString("et-EE")} EUR` : ""}
            </p>
            {g.round_notes && (
              <p className="text-soft" style={{ fontSize: "0.8rem" }}>
                {g.round_notes}
              </p>
            )}
            <h3 style={{ fontSize: "0.95rem", marginTop: "1rem" }}>Nõuded</h3>
            <ul style={{ fontSize: "0.9rem" }}>
              {g.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <a href={g.source_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem" }}>
              Allikas ↗
            </a>
            <p className="text-soft mono" style={{ fontSize: "0.75rem", marginTop: "0.75rem" }}>
              Andmed kontrollitud: {g.last_verified}
            </p>
          </div>
        ))}

      {!loading && grants.length === 0 && !error && <p className="text-soft">Ühtegi toetust ei leitud.</p>}
    </div>
  );
}
