// Samm 5: Skoorimootor
// Rakendab Sammu 4 reeglitabelit sisendväärtustele ja arvutab:
// - koondskoor (0-100)
// - riskitase
// - tugevused (bandid, kus saavutati >=80% max punktidest)
// - nõrkused (bandid, kus saavutati <=30% max punktidest)

import {
  VKE_SCORING_RULES,
  KY_SCORING_RULES,
  matchNumericBand,
  matchCategoricalBand,
  type ScoringRule,
} from "./rules";

export type ScoringInput = Record<string, number | string>;

export interface RuleBreakdown {
  id: string;
  label: string;
  weight: number;
  points: number;
  bandLabel: string;
}

export type RiskLevel = "madal" | "keskmine" | "kõrge";

export interface ScoringResult {
  score: number; // 0-100
  risk_level: RiskLevel;
  strengths: string[];
  weaknesses: string[];
  breakdown: RuleBreakdown[];
}

// Riskitaseme lävendid. Andmed puuduvad valdkonnaeksperdi valideeringu kohta —
// need on esialgsed mõistlikud väärtused, mis vajavad ülevaatust enne live kasutust.
const RISK_THRESHOLDS = {
  madal: 70, // score >= 70
  keskmine: 40, // 40 <= score < 70
  // score < 40 => kõrge
};

const STRENGTH_RATIO = 0.8; // >=80% max punktidest = tugevus
const WEAKNESS_RATIO = 0.3; // <=30% max punktidest = nõrkus

function computeScore(rules: ScoringRule[], input: ScoringInput): ScoringResult {
  const breakdown: RuleBreakdown[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const rule of rules) {
    const rawValue = input[rule.id];

    if (rawValue === undefined || rawValue === null) {
      missing.push(rule.id);
      continue;
    }

    if (rule.type === "numeric_interval") {
      if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
        invalid.push(`${rule.id}: oodati numbrit, saadi "${rawValue}"`);
        continue;
      }
      const band = matchNumericBand(rule, rawValue);
      breakdown.push({
        id: rule.id,
        label: rule.label,
        weight: rule.weight,
        points: band.points,
        bandLabel: band.label,
      });
    } else {
      if (typeof rawValue !== "string") {
        invalid.push(`${rule.id}: oodati stringi (kategooria võti), saadi "${rawValue}"`);
        continue;
      }
      const band = matchCategoricalBand(rule, rawValue);
      if (!band) {
        const validKeys = rule.bands.map((b) => b.key).join(", ");
        invalid.push(`${rule.id}: tundmatu kategooria "${rawValue}" (lubatud: ${validKeys})`);
        continue;
      }
      breakdown.push({
        id: rule.id,
        label: rule.label,
        weight: rule.weight,
        points: band.points,
        bandLabel: band.label,
      });
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`Puuduvad väljad: ${missing.join(", ")}`);
    if (invalid.length > 0) parts.push(`Vigased väärtused: ${invalid.join("; ")}`);
    throw new Error(parts.join(" | "));
  }

  const score = breakdown.reduce((sum, b) => sum + b.points, 0);

  const risk_level: RiskLevel =
    score >= RISK_THRESHOLDS.madal
      ? "madal"
      : score >= RISK_THRESHOLDS.keskmine
        ? "keskmine"
        : "kõrge";

  const strengths = breakdown
    .filter((b) => b.weight > 0 && b.points / b.weight >= STRENGTH_RATIO)
    .map((b) => `${b.label}: ${b.bandLabel}`);

  const weaknesses = breakdown
    .filter((b) => b.weight > 0 && b.points / b.weight <= WEAKNESS_RATIO)
    .map((b) => `${b.label}: ${b.bandLabel}`);

  return { score, risk_level, strengths, weaknesses, breakdown };
}

export function scoreVKE(input: ScoringInput): ScoringResult {
  return computeScore(VKE_SCORING_RULES, input);
}

export function scoreKY(input: ScoringInput): ScoringResult {
  return computeScore(KY_SCORING_RULES, input);
}

export * from "./rules";
