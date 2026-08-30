import { useState } from "react";
import { useRouter } from "next/router";
import UploadPDF from "../components/UploadPDF";
import ScoreCard from "../components/ScoreCard";
import type { ParseStatementResult } from "../api/parse-statement";
import type { NormalizedStatement } from "../lib/normalization";
import type { ScoringResult } from "../lib/scoring";
import type { ActionItem } from "../lib/opportunities";
import type { GrantProgram } from "../api/grants";

interface VKEFormState {
  dscr: string;
  revenue_stability: string;
  cost_structure: string;
  tax_debt: string;
  company_age: string;
  accounting_quality: string;
}

const REVENUE_STABILITY_OPTIONS = [
  { value: "cv_low_trend_up", label: "Stabiilne, kasvav trend" },
  { value: "cv_low_trend_flat", label: "Stabiilne, muutumatu trend" },
  { value: "cv_mid_trend_flat", label: "Keskmine kõikuvus" },
  { value: "cv_high_trend_down", label: "Kõikuv, langev trend" },
];

const COMPANY_AGE_OPTIONS = [
  { value: "0m_6m", label: "0-6 kuud" },
  { value: "6m_12m", label: "6-12 kuud" },
  { value: "1y_3y", label: "1-3 aastat" },
  { value: "3y_plus", label: "3+ aastat" },
];

const ACCOUNTING_QUALITY_OPTIONS = [
  { value: "consistent_no_arrears", label: "Järjepidev, viivisteta" },
  { value: "consistent_minor_arrears", label: "Järjepidev, väiksed viivised" },
  { value: "inconsistent_no_arrears", label: "Ebajärjepidev, viivisteta" },
  { value: "inconsistent_with_arrears", label: "Ebajärjepidev, viivistega" },
];

export default function VKE() {
  const router = useRouter();
  const [normalized, setNormalized] = useState<NormalizedStatement | null>(null);
  const [form, setForm] = useState<VKEFormState>({
    dscr: "",
    revenue_stability: "cv_low_trend_up",
    cost_structure: "",
    tax_debt: "",
    company_age: "3y_plus",
    accounting_quality: "consistent_no_arrears",
  });
  const [scoreResult, setScoreResult] = useState<ScoringResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionItem[] | null>(null);
  const [grants, setGrants] = useState<GrantProgram[] | null>(null);
  const [entityName, setEntityName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleUploadComplete(_parsed: ParseStatementResult, norm: NormalizedStatement) {
    setNormalized(norm);
    const expenses = norm.transactions.filter((t) => t.amount < 0);
    const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const fixedCosts = expenses
      .filter((t) => t.category === "fixed_costs")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const suggestedRatio = totalExpenses > 0 ? (fixedCosts / totalExpenses).toFixed(2) : "";
    setForm((f) => ({ ...f, cost_structure: suggestedRatio }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const input = {
        dscr: parseFloat(form.dscr),
        revenue_stability: form.revenue_stability,
        cost_structure: parseFloat(form.cost_structure),
        tax_debt: parseFloat(form.tax_debt),
        company_age: form.company_age,
        accounting_quality: form.accounting_quality,
      };

      const scoreRes = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: "vke", input }),
      });
      if (!scoreRes.ok) {
        const body = await scoreRes.json().catch(() => ({}));
        throw new Error(body.error || `Skoorimine ebaõnnestus (${scoreRes.status})`);
      }
      const score: ScoringResult = await scoreRes.json();
      setScoreResult(score);

      const oppRes = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(score),
      });
      if (oppRes.ok) {
        const { action_plan } = await oppRes.json();
        setActionPlan(action_plan);
      }

      const grantsRes = await fetch("/api/grants?segment=vke&status=open");
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
    if (!scoreResult) return;
    const reportInput = {
      profile: {
        entity_name: entityName || "Nimetu ettevõte",
        segment: "vke",
        period_analyzed: normalized
          ? `${normalized.transactions[0]?.date ?? "?"} – ${normalized.transactions[normalized.transactions.length - 1]?.date ?? "?"}`
          : "Manuaalne sisend",
      },
      scoringResult: scoreResult,
      actionPlan: actionPlan ?? [],
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
      <div className="eyebrow">VKE</div>
      <h1>Finantsvalmiduse hindamine</h1>

      <div className="card">
        <h3>1. Pangaväljavõte (valikuline, abistav)</h3>
        <UploadPDF onComplete={handleUploadComplete} />
        {normalized && (
          <p className="text-soft mono" style={{ fontSize: "0.85rem" }}>
            {normalized.transactions.length} tehingut tuvastatud. Kulustruktuuri väli täideti
            soovitusliku väärtusega — kontrollige ja korrigeerige vajadusel.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3>2. Finantsnäitajad</h3>
          <div className="field">
            <label>Ettevõtte nimi</label>
            <input type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>DSCR (võlateenindussuhe)</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.dscr}
                onChange={(e) => setForm({ ...form, dscr: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Kulustruktuur (püsikulude osakaal, 0-1)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                required
                value={form.cost_structure}
                onChange={(e) => setForm({ ...form, cost_structure: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Maksuvõlg (EUR)</label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={form.tax_debt}
                onChange={(e) => setForm({ ...form, tax_debt: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Käibe stabiilsus</label>
              <select
                value={form.revenue_stability}
                onChange={(e) => setForm({ ...form, revenue_stability: e.target.value })}
              >
                {REVENUE_STABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Ettevõtte vanus</label>
              <select value={form.company_age} onChange={(e) => setForm({ ...form, company_age: e.target.value })}>
                {COMPANY_AGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Raamatupidamise kvaliteet</label>
              <select
                value={form.accounting_quality}
                onChange={(e) => setForm({ ...form, accounting_quality: e.target.value })}
              >
                {ACCOUNTING_QUALITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Arvutan…" : "Arvuta skoor"}
          </button>
        </div>
      </form>

      {error && <div className="error-box">{error}</div>}

      {scoreResult && (
        <>
          <div className="ledger-rule" />
          <h2>Tulemus</h2>
          <ScoreCard result={scoreResult} />

          {actionPlan && actionPlan.length > 0 && (
            <div className="card">
              <h3>Tegevuskava</h3>
              {actionPlan.map((a, i) => (
                <div key={i} className="breakdown-row">
                  <span>
                    <strong>{a.title}</strong>
                    <br />
                    <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                      {a.description}
                    </span>
                  </span>
                  <span className={`badge status-${a.priority === "high" ? "blocked" : "warning"}`}>
                    {a.priority}
                  </span>
                </div>
              ))}
            </div>
          )}

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
