// Netlify Function (v2, Web API handler)
// Samm 5: Skoorimootori endpoint
// Sisend: { segment: "vke" | "ky", input: ScoringInput }
// Väljund: ScoringResult (skoor, riskitase, tugevused, nõrkused, breakdown)

import { scoreVKE, scoreKY, type ScoringInput } from "../../lib/scoring";

export const config = {
  path: "/api/score",
};

interface ScoreRequestBody {
  segment: "vke" | "ky";
  input: ScoringInput;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: ScoreRequestBody;
  try {
    body = (await req.json()) as ScoreRequestBody;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!body.segment || !["vke", "ky"].includes(body.segment)) {
    return jsonResponse({ error: "Väli 'segment' peab olema 'vke' või 'ky'" }, 400);
  }
  if (!body.input || typeof body.input !== "object") {
    return jsonResponse({ error: "Väli 'input' puudub" }, 400);
  }

  try {
    const result = body.segment === "vke" ? scoreVKE(body.input) : scoreKY(body.input);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse({ error: "Skoorimine ebaõnnestus", detail: String(err) }, 422);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
