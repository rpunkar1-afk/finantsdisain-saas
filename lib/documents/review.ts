// Kontrolör: deterministlik kontroll enne dokumendi väljastamist.
// Kontrollib, et narratiivis olevad arvud pärinevad sisendist või deterministlikust analüüsist,
// et skoor ja riskitase vastavad arvutatud väärtustele, ning et sektsioonid ei oleks tühjad.
// LLM-põhist kontrolli siin tehtud ei ole (see on testbotide hindaja ülesanne), sest see lisaks
// iga dokumendi genereerimisele viivitust.

import type { DocumentAnalysis } from "./generate";

export type ReviewIssueCode = "unsupported_number" | "score_mismatch" | "risk_mismatch" | "empty_section";

export interface ReviewIssue {
  section_id: string;
  code: ReviewIssueCode;
  detail: string;
}

export interface DocumentReview {
  status: "ok" | "warning";
  issues: ReviewIssue[];
}

export interface ReviewSection {
  id: string;
  heading: string;
  narrative: string;
}

// Struktuursed arvud, mis esinevad tekstis loomulikult ega ole andmepunktid
// (nt "3 aasta", "12 kuu", "90 päeva", "x/100"). Aastaarvud 2000-2100 ei kontrollita.
const STRUCTURAL_NUMBERS = new Set([0, 1, 2, 3, 12, 30, 60, 90, 100]);

const NUMBER_RE = /\d+(?:[  ]\d{3})*(?:[.,]\d+)?/g;

export function extractNumbers(text: string): number[] {
  const cleaned = text.replace(/^\s*\d+[.)]\s/gm, ""); // loetelu numbrid "1." "2)"
  const out: number[] = [];
  for (const m of cleaned.matchAll(NUMBER_RE)) {
    const n = parseFloat(m[0].replace(/[  ]/g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function addVariants(set: number[], n: number) {
  set.push(n);
  if (n > 0 && n <= 1) set.push(n * 100); // 0.45 -> 45%
  if (n >= 1000) {
    set.push(n / 1000); // 45000 -> "45 tuhat"
    set.push(n / 1_000_000); // 1 500 000 -> "1,5 mln"
  }
}

export function allowedNumbers(input: Record<string, unknown>, analysis?: DocumentAnalysis): number[] {
  const allowed: number[] = [];
  const source = JSON.stringify({ input, analysis: analysis ?? null });
  for (const n of extractNumbers(source.replace(/"/g, " "))) addVariants(allowed, n);
  for (const v of Object.values(input)) {
    if (typeof v === "number") addVariants(allowed, v);
  }
  return allowed;
}

function isAllowed(n: number, allowed: number[]): boolean {
  if (STRUCTURAL_NUMBERS.has(n)) return true;
  if (Number.isInteger(n) && n >= 2000 && n <= 2100) return true;
  return allowed.some((a) => Math.abs(a - n) <= Math.max(1e-9, Math.abs(a) * 1e-9));
}

export function reviewSections(
  sections: ReviewSection[],
  input: Record<string, unknown>,
  analysis?: DocumentAnalysis,
): DocumentReview {
  const issues: ReviewIssue[] = [];
  const allowed = allowedNumbers(input, analysis);

  for (const s of sections) {
    if (!s.narrative || s.narrative.trim().length < 5) {
      issues.push({ section_id: s.id, code: "empty_section", detail: "sektsioon on tühi" });
      continue;
    }

    const bad = [...new Set(extractNumbers(s.narrative).filter((n) => !isAllowed(n, allowed)))];
    for (const n of bad) {
      issues.push({ section_id: s.id, code: "unsupported_number", detail: `arv ${n} ei pärine sisendist ega analüüsist` });
    }

    if (analysis) {
      for (const m of s.narrative.matchAll(/(\d+(?:[.,]\d+)?)\s*\/\s*100/g)) {
        if (parseFloat(m[1].replace(",", ".")) !== analysis.score) {
          issues.push({ section_id: s.id, code: "score_mismatch", detail: `tekstis ${m[0]}, arvutatud skoor on ${analysis.score}` });
        }
      }
      for (const m of s.narrative.matchAll(/riskitase(?:me)?(?:\s+on|:)?\s+(madal|keskmine|kõrge)/gi)) {
        if (m[1].toLowerCase() !== analysis.risk_level) {
          issues.push({ section_id: s.id, code: "risk_mismatch", detail: `tekstis "${m[1]}", arvutatud riskitase on "${analysis.risk_level}"` });
        }
      }
    }
  }

  return { status: issues.length > 0 ? "warning" : "ok", issues };
}
