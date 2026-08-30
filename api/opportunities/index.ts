// Netlify Function (v2, Web API handler)
// Samm 6: VKE tegevuskava endpoint
// Sisend: Sammu 5 (score) VKE ScoringResult
// Väljund: ActionItem[]

import { generateVKEActionPlan } from "../../lib/opportunities";
import type { ScoringResult } from "../../lib/scoring";

export const config = {
  path: "/api/opportunities",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let scoringResult: ScoringResult;
  try {
    scoringResult = (await req.json()) as ScoringResult;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!scoringResult || !Array.isArray(scoringResult.breakdown) || !scoringResult.risk_level) {
    return jsonResponse(
      { error: "Sisend peab olema Sammu 5 (score) VKE ScoringResult objekt" },
      400,
    );
  }

  try {
    const plan = generateVKEActionPlan(scoringResult);
    return jsonResponse({ action_plan: plan }, 200);
  } catch (err) {
    return jsonResponse({ error: "Tegevuskava genereerimine ebaõnnestus", detail: String(err) }, 500);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
