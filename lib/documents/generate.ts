// Dokumendigeneraatori tuumaloogika.
// Sama muster mis lib/reporting: iga sektsioon genereeritakse eraldi Claude
// API kutsega, lähtudes ainult kasutaja antud sisendist. Ei leiuta fakte ega
// numbreid, mida sisendis pole.

import Anthropic from "@anthropic-ai/sdk";
import { getDocumentType, type DocumentTypeConfig } from "./registry";
import { scoreVKE, scoreKY, type ScoringResult } from "../scoring";
import { generateVKEActionPlan, type ActionItem } from "../opportunities";
import { reviewSections, type DocumentReview } from "./review";
import { checkKYReadiness, type ChecklistItem, type KYReadinessInput } from "../ky/readiness";

export interface GeneratedSection {
  id: string;
  heading: string;
  narrative: string;
}

// Deterministlik analüüs (skoorimootor + tegevuskava), arvutatud enne narratiivi kirjutamist.
// Claude ei arvuta neid numbreid ise, ta ainult selgitab neid.
export interface DocumentAnalysis {
  segment: "vke" | "ky";
  score: number;
  risk_level: ScoringResult["risk_level"];
  strengths: string[];
  weaknesses: string[];
  breakdown: ScoringResult["breakdown"];
  action_plan: ActionItem[];
  plan_90d: PlanPhase[];
  // Ainult KÜ segment: valmiduse kontrollnimekiri ja sammud EIS taotluseni
  ky_readiness?: { overall_ready: boolean; checklist: ChecklistItem[]; next_steps: string[] };
}

export interface PlanPhase {
  phase: "1-30" | "31-60" | "61-90";
  items: ActionItem[];
  checkpoint?: string; // kindel kontrollpunkt (ainult viimases etapis)
}

// Deterministlik etappidesse jaotus: kõrge prioriteet 1-30, keskmine 31-60,
// viimane etapp on alati uuesti-skoorimise kontrollpunkt.
export const FINAL_CHECKPOINT =
  "Arvuta skoor uuesti värskete andmetega (Finantsvalmiduse hinnang) ja otsusta, kas laenutaotlus on valmis esitamiseks.";

export function buildPlan90d(actionPlan: ActionItem[]): PlanPhase[] {
  return [
    { phase: "1-30", items: actionPlan.filter((a) => a.priority === "high") },
    { phase: "31-60", items: actionPlan.filter((a) => a.priority !== "high") },
    { phase: "61-90", items: [], checkpoint: FINAL_CHECKPOINT },
  ];
}

export interface GeneratedDocument {
  document_id: string;
  type_id: string;
  generated_at: string; // ISO 8601
  input: Record<string, string | number>;
  analysis?: DocumentAnalysis;
  review?: DocumentReview; // Kontrolöri tulemus (Samm 3)
  sections: GeneratedSection[];
}

export function computeAnalysis(config: DocumentTypeConfig, input: Record<string, string | number>): DocumentAnalysis | undefined {
  if (!config.analysis) return undefined;

  if (config.analysis.segment === "ky") {
    const ky = checkKYReadiness(input as unknown as KYReadinessInput);
    const scored = scoreKY(input);
    return {
      segment: "ky",
      score: scored.score,
      risk_level: scored.risk_level,
      strengths: scored.strengths,
      weaknesses: scored.weaknesses,
      breakdown: scored.breakdown,
      action_plan: [],
      plan_90d: [],
      ky_readiness: { overall_ready: ky.overall_ready, checklist: ky.checklist, next_steps: ky.next_steps },
    };
  }

  const result = scoreVKE(input);
  const action_plan = generateVKEActionPlan(result);
  return {
    segment: "vke",
    score: result.score,
    risk_level: result.risk_level,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    breakdown: result.breakdown,
    action_plan,
    plan_90d: buildPlan90d(action_plan),
  };
}

const DOCUMENT_SYSTEM_PROMPT = `Sa oled P.E.E.T.E.R. — Finantsdisain AI finants- ja äristrateegia analüütik.
Sinu ülesanne on kirjutada üks dokumendi sektsioon, lähtudes sulle antud struktureeritud andmetest.

Reeglid:
- Kirjuta eesti keeles, professionaalses, otsekoheses toonis. Ei liigset entusiasmi, ei ebamäärasust.
- Kasuta AINULT sulle antud andmeid. Ära leiuta fakte, numbreid ega soovitusi, mida andmetes pole.
- Kui andmetes on "analysis" (skoor, riskitase, breakdown, tegevuskava), on need deterministlikult arvutatud: kasuta neid täpselt nii nagu antud, ära arvuta ega ümardada ümber.
- Kui mõni vajalik andmepunkt on puudu, ütle seda otse ("andmed puuduvad"), ära oleta.
- Pikkus: 3-6 lauset, v.a kui juhend ütleb teisiti.
- Ära korda pealkirja tekstis.
- Vasta AINULT sektsiooni tekstiga, ilma preambulita, ilma markdown-pealkirjadeta.`;

async function generateSectionText(
  anthropic: Anthropic,
  heading: string,
  instruction: string,
  data: unknown,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: DOCUMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Sektsioon: ${heading}\n\nJuhend: ${instruction}\n\nAndmed:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Claude API ei tagastanud teksti sektsiooni "${heading}" jaoks`);
  }
  return textBlock.text.trim();
}

export async function generateDocument(
  typeId: string,
  input: Record<string, string | number>,
  apiKey: string,
  documentId: string,
  client?: Anthropic,
): Promise<GeneratedDocument> {
  const config: DocumentTypeConfig | undefined = getDocumentType(typeId);
  if (!config) {
    throw new Error(`Tundmatu dokumenditüüp: ${typeId}`);
  }

  const anthropic = client ?? new Anthropic({ apiKey });

  const analysis = computeAnalysis(config, input);
  const promptData = analysis ? { input, analysis } : input;

  let sections: GeneratedSection[] = await Promise.all(
    config.sections.map(async (s) => ({
      id: s.id,
      heading: s.heading,
      narrative: await generateSectionText(anthropic, s.heading, s.instruction, promptData),
    })),
  );

  // Kontrolör: deterministlik kontroll. Probleemsed sektsioonid kirjutatakse ÜKS kord ümber
  // (paralleelselt), tagasisidega, millised arvud ei pärine sisendist.
  let review = reviewSections(sections, input, analysis);
  if (review.status === "warning") {
    const badIds = new Set(review.issues.map((i) => i.section_id));
    sections = await Promise.all(
      sections.map(async (sec) => {
        if (!badIds.has(sec.id)) return sec;
        const def = config.sections.find((d) => d.id === sec.id)!;
        const feedback = review.issues
          .filter((i) => i.section_id === sec.id)
          .map((i) => i.detail)
          .join("; ");
        const narrative = await generateSectionText(
          anthropic,
          def.heading,
          `${def.instruction}\n\nEELMINE VERSIOON EI LÄINUD KONTROLLI: ${feedback}. Kasuta ainult sisendis ja analüüsis olevaid arve, ära arvuta ega hinda uusi numbreid.`,
          promptData,
        );
        return { ...sec, narrative };
      }),
    );
    review = reviewSections(sections, input, analysis);
  }

  return {
    document_id: documentId,
    type_id: typeId,
    generated_at: new Date().toISOString(),
    input,
    ...(analysis ? { analysis } : {}),
    review,
    sections,
  };
}
