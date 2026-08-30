// Netlify Function (v2, Web API handler)
// Samm 10: Raportigeneraatori endpoint
// Sisend: ReportInput (profile, scoringResult, actionPlan?, kyReadiness?, matchedGrants)
// Väljund: Report (narratiivsed sektsioonid + raw_data)

import { generateReport, type ReportInput, type Report } from "../../lib/reporting";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

export const config = {
  path: "/api/report",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const reportId = url.searchParams.get("id");
    if (!reportId) {
      return jsonResponse({ error: "Query param 'id' on kohustuslik GET päringul" }, 400);
    }
    try {
      const reportsStore = getStore("reports");
      const data = await reportsStore.get(reportId, { type: "json" });
      if (!data) {
        return jsonResponse({ error: `Raportit id="${reportId}" ei leitud` }, 404);
      }
      return jsonResponse(data, 200);
    } catch (err) {
      return jsonResponse({ error: "Raporti taastamine ebaõnnestus", detail: String(err) }, 500);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Server misconfiguration: ANTHROPIC_API_KEY puudub" }, 500);
  }

  let input: ReportInput;
  try {
    input = (await req.json()) as ReportInput;
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }

  if (!input.profile || !input.scoringResult || !Array.isArray(input.matchedGrants)) {
    return jsonResponse(
      { error: "Sisend peab sisaldama 'profile', 'scoringResult' ja 'matchedGrants' väljasid" },
      400,
    );
  }

  try {
    const report: Report = await generateReport(input, apiKey);
    const reportId = randomUUID();
    report.report_id = reportId;

    try {
      const reportsStore = getStore("reports");
      await reportsStore.setJSON(reportId, report, {
        metadata: { entity_name: input.profile.entity_name, generated_at: report.generated_at },
      });
    } catch (err) {
      console.error("Raporti blob salvestus ebaõnnestus:", err);
    }

    return jsonResponse(report, 200);
  } catch (err) {
    return jsonResponse({ error: "Raporti genereerimine ebaõnnestus", detail: String(err) }, 502);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
