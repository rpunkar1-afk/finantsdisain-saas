import { useState } from "react";
import { useRouter } from "next/router";
import ReadinessCard from "../components/ReadinessCard";
import type { KYReadinessInput, KYReadinessResult } from "../api/ky-readiness";
import type { GrantProgram } from "../api/grants";

const GENERAL_MEETING_OPTIONS = [
  { value: "two_thirds_majority", label: "2/3 häälteenamus saavutatud" },
  { value: "simple_majority", label: "50% (lihthäälteenamus) saavutatud" },
  { value: "missing", label: "Otsus puudub" },
];

const ENERGY_LABEL_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "none"];

export default function KY() {
  const router = useRouter();
  const [entityName, setEntityName] = useState("");
  const [form, setForm] = useState<KYReadinessInput>({
    ky_debt_ratio: 0,
    maintenance_fund_coverage: 0,
    general_meeting_decision: "two_thirds_majority",
    energy_label: "none",
    technical_consultant: "not_engaged",
  });
  const [result, setResult] = useState<KYReadinessResult | null>(null);
  const [grants, setGrants] = useState<GrantProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ky-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Kontroll ebaõnnestus (${res.status})`);
      }
      const data: KYReadinessResult = await res.json();
      setResult(data);

      const grantsRes = await fetch("/api/grants?segment=ky&status=open");
      if (grantsRes.ok) {
        const { grants: g } = await grantsRes.json();
        setGrants(g);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateReport() {
    if (!result) return;
    const reportInput = {
      profile: {
        entity_name: entityName || "Nimetu korteriühistu",
        segment: "ky",
        period_analyzed: "Manuaalne sisend",
      },
      scoringResult: {
        score: result.score,
        risk_level: result.risk_level,
        strengths: [],
        weaknesses: result.checklist.filter((c) => c.status !== "ok").map((c) => `${c.label}: ${c.detail}`),
        breakdown: [],
      },
      kyReadiness: {
        overall_ready: result.overall_ready,
        checklist_summary: result.checklist.map((c) => `${c.label}: ${c.status}`).join("; "),
        next_steps: result.next_steps,
      },
      matchedGrants: (grants ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        provider: g.provider,
        max_amount_eur: g.max_amount_eur,
        funding_rate: g.funding_rate,
      })),
    };
    sessionStorage.setItem("finantsdisain_report_input", JSON.stringify(reportInput));
    router.push("/report");
  }

  return (
    <div className="page">
      <div className="eyebrow">Korteriühistu</div>
      <h1>KÜ valmisoleku kontroll</h1>

        <div className="card">
          <p className="text-soft" style={{ marginTop: 0 }}>
            Pole kindel, kas täisanalüüs on praegu mõttekas? Täitke 2-minutiline eelkvalifitseerimise
            vorm — saate kiire suuna, kuhu edasi minna.
          </p>
          <a
            className="button secondary small"
            href="https://tally.so/r/9q0pgQ"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kiirvorm →
          </a>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label>Korteriühistu nimi</label>
            <input type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Liikmete võlgnevused (osakaal, nt 0.05 = 5%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                required
                value={form.ky_debt_ratio}
                onChange={(e) => setForm({ ...form, ky_debt_ratio: parseFloat(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Hooldusfondi kate (EUR/m²)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.maintenance_fund_coverage}
                onChange={(e) => setForm({ ...form, maintenance_fund_coverage: parseFloat(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Üldkoosoleku otsus</label>
              <select
                value={form.general_meeting_decision}
                onChange={(e) =>
                  setForm({ ...form, general_meeting_decision: e.target.value as KYReadinessInput["general_meeting_decision"] })
                }
              >
                {GENERAL_MEETING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Energiamärgis</label>
              <select
                value={form.energy_label}
                onChange={(e) => setForm({ ...form, energy_label: e.target.value as KYReadinessInput["energy_label"] })}
              >
                {ENERGY_LABEL_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l === "none" ? "Puudub" : l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tehniline konsultant</label>
              <select
                value={form.technical_consultant}
                onChange={(e) =>
                  setForm({ ...form, technical_consultant: e.target.value as KYReadinessInput["technical_consultant"] })
                }
              >
                <option value="engaged">Kaasatud</option>
                <option value="not_engaged">Mitte kaasatud</option>
              </select>
            </div>
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Kontrollin…" : "Kontrolli valmisolekut"}
          </button>
        </div>
      </form>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <>
          <div className="ledger-rule" />
          <h2>Tulemus</h2>
          <ReadinessCard result={result} />

          {grants && grants.length > 0 && (
            <div className="card">
              <h3>Sobivad toetused</h3>
              {grants.map((g) => (
                <div key={g.id} className="breakdown-row">
                  <span>{g.name}</span>
                  <span className="text-soft mono" style={{ fontSize: "0.85rem" }}>
                    {g.max_amount_eur ? `kuni ${g.max_amount_eur.toLocaleString("et-EE")} EUR` : g.funding_rate}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button className="button" style={{ marginTop: "1.5rem" }} onClick={handleGenerateReport}>
            Genereeri raport
          </button>
        </>
      )}
    </div>
  );
}
