// Samm 4: Skoorimootori reeglite tabel
// Deterministlik, kaalutud punktisüsteem. Kaks eraldi tabelit: VKE ja KÜ.
// Skoorimootor (Samm 5) rakendab neid reegleid ja arvutab koondskoori 0-100.
//
// Numbrilised reeglid kasutavad [min, max) poolavatud intervalle, v.a juhul
// kui min === max, mis tähistab täpset väärtust (nt "maksuvõlg = 0").
// See väldib nihkeid piirväärtustel (nt väärtus 0 ei tohi sattuda vahemikku "< 1000").

export type ScoreBand = {
  label: string;
  points: number;
};

export interface NumericIntervalBand extends ScoreBand {
  min: number; // inklusiivne (v.a võrdusband, kus min === max)
  max: number; // eksklusiivne (v.a võrdusband)
}

export interface NumericRule {
  id: string;
  label: string;
  type: "numeric_interval";
  weight: number; // max punktid selle reegli eest
  unit: string;
  bands: NumericIntervalBand[]; // järjestus oluline: võrdusbandid enne vahemikubande
}

export interface CategoricalBand extends ScoreBand {
  key: string;
}

export interface CategoricalRule {
  id: string;
  label: string;
  type: "categorical";
  weight: number;
  bands: CategoricalBand[];
}

export type ScoringRule = NumericRule | CategoricalRule;

// ---------------------------------------------------------------------------
// VKE reeglite tabel (kokku 100 punkti)
// ---------------------------------------------------------------------------

export const VKE_SCORING_RULES: ScoringRule[] = [
  {
    id: "dscr",
    label: "DSCR (Debt Service Coverage Ratio)",
    type: "numeric_interval",
    weight: 25,
    unit: "ratio",
    bands: [
      { min: 1.6, max: Infinity, points: 25, label: ">= 1.6" },
      { min: 1.4, max: 1.6, points: 18, label: "1.4 - 1.6" },
      { min: 1.2, max: 1.4, points: 10, label: "1.2 - 1.4" },
      { min: -Infinity, max: 1.2, points: 0, label: "< 1.2" },
    ],
  },
  {
    id: "revenue_stability",
    label: "Käibe stabiilsus (variatsioonikordaja CV + trend)",
    type: "categorical",
        weight: 20,
    bands: [
      { key: "cv_low_trend_up", points: 20, label: "CV < 0.15, positiivne trend" },
      { key: "cv_low_trend_flat", points: 13, label: "CV < 0.15, stabiilne/langev trend, VÕI CV 0.15-0.30 positiivne" },
      { key: "cv_mid_trend_flat", points: 7, label: "CV 0.15-0.30 stabiilne/langev, VÕI CV > 0.30 positiivne" },
      { key: "cv_high_trend_down", points: 0, label: "CV > 0.30, langev trend" },
    ],
  },
  {
    id: "cost_structure",
    label: "Kulustruktuur (püsikulude osakaal kogukuludest)",
    type: "numeric_interval",
    weight: 15,
    unit: "ratio",
    bands: [
      { min: -Infinity, max: 0.4, points: 15, label: "< 40%" },
      { min: 0.4, max: 0.6, points: 10, label: "40 - 60%" },
      { min: 0.6, max: 0.8, points: 5, label: "60 - 80%" },
      { min: 0.8, max: Infinity, points: 0, label: ">= 80%" },
    ],
  },
  {
    id: "tax_debt",
    label: "Maksuvõlg",
    type: "numeric_interval",
    weight: 15,
    unit: "EUR",
    bands: [
      { min: 0, max: 0, points: 15, label: "0 EUR" },
      { min: 0, max: 1000, points: 8, label: "0 < x < 1000 EUR" },
      { min: 1000, max: Infinity, points: 0, label: ">= 1000 EUR" },
    ],
  },
  {
    id: "company_age",
    label: "Ettevõtte vanus",
    type: "categorical",
        weight: 10,
    bands: [
      { key: "3y_plus", points: 10, label: "3+ aastat" },
      { key: "1y_3y", points: 7, label: "1-3 aastat" },
      { key: "6m_12m", points: 3, label: "6-12 kuud" },
      { key: "0m_6m", points: 0, label: "0-6 kuud" },
    ],
  },
  {
    id: "accounting_quality",
    label: "Raamatupidamise kvaliteet (järjepidevus, viivised)",
    type: "categorical",
    weight: 15,
    bands: [
      { key: "consistent_no_arrears", points: 15, label: "Järjepidev, viivisteta" },
      { key: "consistent_minor_arrears", points: 10, label: "Järjepidev, väiksed viivised" },
      { key: "inconsistent_no_arrears", points: 5, label: "Ebajärjepidev, viivisteta" },
      { key: "inconsistent_with_arrears", points: 0, label: "Ebajärjepidev, viivistega" },
    ],
  },
];

// ---------------------------------------------------------------------------
// KÜ reeglite tabel (kokku 100 punkti)
// ---------------------------------------------------------------------------

export const KY_SCORING_RULES: ScoringRule[] = [
  {
    id: "ky_debt_ratio",
    label: "KÜ liikmete võlgnevused (% majanduskuludest)",
    type: "numeric_interval",
    weight: 30,
    unit: "ratio",
    bands: [
      { min: -Infinity, max: 0.05, points: 30, label: "< 5%" },
      { min: 0.05, max: 0.1, points: 15, label: "5 - 10%" },
      { min: 0.1, max: Infinity, points: 0, label: ">= 10%" },
    ],
  },
  {
    id: "maintenance_fund_coverage",
    label: "Hooldusfondi kate (EUR/m²)",
    type: "numeric_interval",
    weight: 30,
    unit: "EUR/m2",
    bands: [
      { min: 1.0, max: Infinity, points: 30, label: ">= 1.0 EUR/m²" },
      { min: 0.5, max: 1.0, points: 15, label: "0.5 - 1.0 EUR/m²" },
      { min: -Infinity, max: 0.5, points: 0, label: "< 0.5 EUR/m²" },
    ],
  },
  {
    id: "general_meeting_decision",
    label: "Üldkoosoleku otsus laenu/investeeringu kohta",
    type: "categorical",
    weight: 40,
    bands: [
      { key: "two_thirds_majority", points: 40, label: "2/3 häälteenamus" },
      { key: "simple_majority", points: 20, label: "50% (lihthäälteenamus)" },
      { key: "missing", points: 0, label: "Otsus puudub" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup-abifunktsioonid tabeli kasutamiseks (Samm 5 rakendab neid)
// ---------------------------------------------------------------------------

export function matchNumericBand(rule: NumericRule, value: number): NumericIntervalBand {
  for (const band of rule.bands) {
    if (band.min === band.max) {
      if (value === band.min) return band;
    } else if (value >= band.min && value < band.max) {
      return band;
    }
  }
  return rule.bands[rule.bands.length - 1];
}

export function matchCategoricalBand(
  rule: CategoricalRule,
  key: string,
): CategoricalBand | undefined {
  return rule.bands.find((b) => b.key === key);
}

export function totalWeight(rules: ScoringRule[]): number {
  return rules.reduce((sum, r) => sum + r.weight, 0);
}
