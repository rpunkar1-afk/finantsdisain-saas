// Netlify Function (v2, Web API handler)
// Samm 7: KÜ valmisoleku kontroll
// Kontrollib: üldkoosoleku otsus, hooldusfond, võlgnevused, energiamärgis, tehniline konsultant
// Tagastab: checklist (ok/warning/blocked iga kriteeriumi kohta) + samm-sammuline tee EIS taotluseni

import { checkKYReadiness, type KYReadinessInput } from "../../lib/ky/readiness";

export const config = {
  path: "/api/ky-readiness",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let input: KYReadinessInput;
  try {
    input = (await req.json()) as KYReadinessInput;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  const required = [
    "ky_debt_ratio",
    "maintenance_fund_coverage",
    "general_meeting_decision",
    "energy_label",
    "technical_consultant",
  ];
  const missing = required.filter((k) => (input as unknown as Record<string, unknown>)[k] === undefined);
  if (missing.length > 0) {
    return jsonResponse({ error: `Puuduvad väljad: ${missing.join(", ")}` }, 400);
  }

  try {
    const result = checkKYReadiness(input);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse({ error: "Valmisoleku kontroll ebaõnnestus", detail: String(err) }, 500);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
