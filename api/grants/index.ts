// Netlify Function (v2, Web API handler)
// Samm 8: Toetuste radar (Kiht 2)
// Andmeallikas: käsitsi kureeritav data.json (avatud/suletud/tulevased voorud, tähtajad, nõuded)
// Query params: ?status=open|closed|upcoming  ?segment=vke|ky|both

import grantsData from "./data.json";

export const config = {
  path: "/api/grants",
};

export type GrantStatus = "open" | "closed" | "upcoming";
export type GrantSegment = "vke" | "ky" | "both";

export interface GrantProgram {
  id: string;
  name: string;
  provider: string;
  target_segment: GrantSegment;
  status: GrantStatus;
  round_opens: string | null;
  round_closes: string | null;
  round_notes: string;
  max_amount_eur: number | null;
  funding_rate: string;
  requirements: string[];
  description: string;
  source_url: string;
  last_verified: string;
}

// Tuletab tegeliku staatuse kuupäevade põhjal, kui need on määratud.
// Kui round_opens/round_closes puuduvad (jooksev/mitmeaastane meede), usaldatakse
// kureeritud "status" välja otse.
function resolveStatus(grant: GrantProgram, now: Date): GrantStatus {
  if (grant.round_opens) {
    const opensAt = new Date(grant.round_opens);
    if (now < opensAt) return "upcoming";
  }
  if (grant.round_closes) {
    const closesAt = new Date(grant.round_closes);
    if (now > closesAt) return "closed";
  }
  return grant.status;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as GrantStatus | null;
  const segmentFilter = url.searchParams.get("segment") as GrantSegment | null;

  const now = new Date();
  let grants = (grantsData as GrantProgram[]).map((g) => ({
    ...g,
    status: resolveStatus(g, now),
  }));

  if (statusFilter && !["open", "closed", "upcoming"].includes(statusFilter)) {
    return jsonResponse({ error: "Vigane 'status' filter (open|closed|upcoming)" }, 400);
  }
  if (segmentFilter && !["vke", "ky", "both"].includes(segmentFilter)) {
    return jsonResponse({ error: "Vigane 'segment' filter (vke|ky|both)" }, 400);
  }

  if (statusFilter) {
    grants = grants.filter((g) => g.status === statusFilter);
  }
  if (segmentFilter) {
    grants = grants.filter((g) => g.target_segment === segmentFilter || g.target_segment === "both");
  }

  return jsonResponse({ count: grants.length, grants }, 200);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
