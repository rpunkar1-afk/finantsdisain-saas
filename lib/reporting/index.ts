// Samm 10: Raportigeneraator
// Kombineerib Sammude 5-9 väljundid üheks professionaalseks raportiks:
// finantsprofiil, skoorid, riskid, võimalused, tegevuskava, toetused, KÜ valmisolek (kui kohaldub)

import Anthropic from "@anthropic-ai/sdk";
import type { ScoringResult } from "../scoring";
import type { ActionItem } from "../opportunities";

export type ReportSegment = "vke" | "ky";

export interface FinancialProfile {
  entity_name: string;
  segment: ReportSegment;
  // VKE-spetsiifiline
  emtak_code?: string;
  company_age_years?: number;
  // KÜ-spetsiifiline
  address?: string;
  unit_count?: number;
  // Ühine
  period_analyzed: string; // nt "2025-08 - 2026-07"
}

export interface MatchedGrant {
  id: string;
  name: string;
  provider: string;
  max_amount_eur: number | null;
  funding_rate: string;
}

export interface KYReadinessSummary {
  overall_ready: boolean;
  checklist_summary: string; // lühikokkuvõte checklist staatustest
  next_steps: string[];
}

export interface ReportInput {
  profile: FinancialProfile;
  scoringResult: ScoringResult;
  actionPlan?: ActionItem[]; // VKE segment
  kyReadiness?: KYReadinessSummary; // KY segment
  matchedGrants: MatchedGrant[];
}

export interface ReportSection {
  heading: string;
  narrative: string; // Claude API genereeritud prosa
}

export interface Report {
  generated_at: string; // ISO 8601
  report_id?: string; // Samm 12: viide salvestatud raportile Netlify Blobs-is
  profile: FinancialProfile;
  sections: {
    finantsprofiil: ReportSection;
    skoorid: ReportSection;
    riskid: ReportSection;
    voimalused: ReportSection;
    tegevuskava: ReportSection;
    toetused: ReportSection;
    ky_valmisolek: ReportSection | null; // ainult KY segment
  };
  raw_data: {
    score: number;
    risk_level: string;
    breakdown: ScoringResult["breakdown"];
    action_plan: ActionItem[] | null;
    matched_grants: MatchedGrant[];
    ky_readiness: KYReadinessSummary | null;
  };
}

const REPORT_SYSTEM_PROMPT = `Sa oled P.E.E.T.E.R. — Finantsdisain AI finants- ja äristrateegia analüütik.
Sinu ülesanne on kirjutada üks raporti sektsioon, lähtudes sulle antud struktureeritud andmetest.

Reeglid:
- Kirjuta eesti keeles, professionaalses, otsekoheses toonis. Ei liigset entusiasmi, ei ebamäärasust.
- Kasuta AINULT sulle antud andmeid. Ära leiuta fakte, numbreid ega soovitusi, mida andmetes pole.
- Pikkus: 3-6 lauset, v.a kui juhend ütleb teisiti.
- Ära korda pealkirja tekstis.
- Vasta AINULT raporti sektsiooni tekstiga, ilma preambulita, ilma markdown-pealkirjadeta.`;

async function generateSection(
  anthropic: Anthropic,
  sectionName: string,
  instructions: string,
  data: unknown,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: REPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Sektsioon: ${sectionName}\n\nJuhend: ${instructions}\n\nAndmed:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Claude API ei tagastanud teksti sektsiooni "${sectionName}" jaoks`);
  }
  return textBlock.text.trim();
}

export async function generateReport(
  input: ReportInput,
  apiKey: string,
  client?: Anthropic,
): Promise<Report> {
  const anthropic = client ?? new Anthropic({ apiKey });
  const { profile, scoringResult, actionPlan, kyReadiness, matchedGrants } = input;

  const [finantsprofiilText, skooridText, riskidText, voimalusedText, tegevuskavaText, toetusedText, kyText] =
    await Promise.all([
      generateSection(
        anthropic,
        "Finantsprofiil",
        "Kirjelda lühidalt analüüsitud üksust ja perioodi.",
        profile,
      ),
      generateSection(
        anthropic,
        "Skoorid",
        "Selgita koondskoori ja riskitaset kriteeriumite lõikes.",
        { score: scoringResult.score, risk_level: scoringResult.risk_level, breakdown: scoringResult.breakdown },
      ),
      generateSection(
        anthropic,
        "Riskid",
        "Too välja peamised nõrkused ja riskid.",
        { weaknesses: scoringResult.weaknesses, risk_level: scoringResult.risk_level },
      ),
      generateSection(
        anthropic,
        "Võimalused",
        "Too välja tugevused ja positiivsed signaalid.",
        { strengths: scoringResult.strengths },
      ),
      generateSection(
        anthropic,
        "Tegevuskava",
        actionPlan
          ? "Kokkuvõta soovitatud tegevused prioriteedi järgi."
          : "Tegevuskava ei ole selle segmendi jaoks genereeritud (KÜ segment kasutab valmisoleku sammusid).",
        actionPlan ?? kyReadiness?.next_steps ?? [],
      ),
      generateSection(
        anthropic,
        "Toetused",
        matchedGrants.length > 0
          ? "Tutvusta sobivaid toetusprogramme."
          : "Ühtegi sobivat toetusprogrammi ei leitud praeguste kriteeriumite alusel.",
        matchedGrants,
      ),
      profile.segment === "ky" && kyReadiness
        ? generateSection(
            anthropic,
            "KÜ valmisolek",
            "Kokkuvõta valmisoleku staatus ja järgmised sammud KredEx/EIS taotluseni.",
            kyReadiness,
          )
        : Promise.resolve(""),
    ]);

  return {
    generated_at: new Date().toISOString(),
    profile,
    sections: {
      finantsprofiil: { heading: "Finantsprofiil", narrative: finantsprofiilText },
      skoorid: { heading: "Skoorid", narrative: skooridText },
      riskid: { heading: "Riskid", narrative: riskidText },
      voimalused: { heading: "Võimalused", narrative: voimalusedText },
      tegevuskava: { heading: "Tegevuskava", narrative: tegevuskavaText },
      toetused: { heading: "Toetused", narrative: toetusedText },
      ky_valmisolek:
        profile.segment === "ky" && kyReadiness
          ? { heading: "KÜ valmisolek", narrative: kyText }
          : null,
    },
    raw_data: {
      score: scoringResult.score,
      risk_level: scoringResult.risk_level,
      breakdown: scoringResult.breakdown,
      action_plan: actionPlan ?? null,
      matched_grants: matchedGrants,
      ky_readiness: kyReadiness ?? null,
    },
  };
}
