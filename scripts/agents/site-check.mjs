// Live-saidi analüüs ilma brauserita: roomab sisemisi linke, kontrollib staatusi, metaandmeid,
// turvapäiseid, aeglasi vastuseid ja välislinke. Ei käivita JavaScripti (seega konsoolivigu ei näe).
// Käivitus: node scripts/agents/site-check.mjs
// Keskkonnamuutujad: TARGET_URL (vaikimisi https://financedesign.ai), MAX_PAGES (vaikimisi 60)
// Väljund: JSON stdout-i ja fail site-check-report.json

import { writeFileSync } from "node:fs";

const TARGET = (process.env.TARGET_URL || "https://financedesign.ai").replace(/\/+$/, "");
const ORIGIN = new URL(TARGET).origin;
const MAX_PAGES = Number(process.env.MAX_PAGES || 60);
const MAX_EXTERNAL = 25;
const SLOW_MS = 3000;
const SECURITY_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "content-security-policy",
];

async function get(url, method = "GET") {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { method, signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "finantsdisain-site-check/1.0" } });
    const text = method === "GET" ? await r.text() : "";
    return { status: r.status, headers: r.headers, text, ms: Date.now() - started, finalUrl: r.url };
  } catch (e) {
    return { status: 0, error: String(e.message || e), headers: new Headers(), text: "", ms: Date.now() - started, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

function extractLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)(?:#[^"']*)?["']/gi)) {
    const href = m[1].trim();
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      out.add(new URL(href, base).toString().replace(/\/+$/, "") || ORIGIN);
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

const report = { target: TARGET, generatedAt: new Date().toISOString(), pages: [], brokenInternal: [], externalIssues: [], findings: [], limitations: ["Skript ei käivita JavaScripti: brauseri konsoolivigu ja ainult kliendi poolel renderdatud sisu ta ei näe."] };

const queue = [TARGET];
const seen = new Set([TARGET]);
const externals = new Set();
const referrers = new Map();

while (queue.length && report.pages.length < MAX_PAGES) {
  const url = queue.shift();
  const r = await get(url);
  const ct = r.headers.get("content-type") || "";
  const isHtml = /text\/html/i.test(ct);
  const page = { url, status: r.status, ms: r.ms, contentType: ct };
  if (r.error) page.error = r.error;

  if (isHtml && r.status === 200) {
    const title = (r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
    const desc = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i.test(r.text);
    page.title = title || null;
    page.hasMetaDescription = desc;
    if (!title) report.findings.push({ severity: "KESKMINE", url, issue: "puudub <title>" });
    if (!desc) report.findings.push({ severity: "MADAL", url, issue: "puudub meta description" });
    for (const link of extractLinks(r.text, r.finalUrl)) {
      if (!referrers.has(link)) referrers.set(link, url);
      if (link.startsWith(ORIGIN)) {
        if (!seen.has(link)) {
          seen.add(link);
          queue.push(link);
        }
      } else {
        externals.add(link);
      }
    }
  }
  if (r.status === 0 || r.status >= 400) {
    report.brokenInternal.push({ url, status: r.status, error: r.error, linkedFrom: referrers.get(url) || null });
  }
  if (r.ms > SLOW_MS) report.findings.push({ severity: "MADAL", url, issue: `aeglane vastus ${r.ms} ms` });
  if (url === TARGET) {
    const missing = SECURITY_HEADERS.filter((h) => !r.headers.has(h));
    if (!r.headers.has("x-frame-options") && !/frame-ancestors/i.test(r.headers.get("content-security-policy") || "")) {
      missing.push("x-frame-options (või CSP frame-ancestors)");
    }
    report.securityHeadersMissing = missing;
    for (const h of missing) report.findings.push({ severity: "KESKMINE", url, issue: `puudub turvapäis: ${h}` });
  }
  report.pages.push(page);
}

if (queue.length > 0) report.limitations.push(`Lehtede piir ${MAX_PAGES} täis, ${queue.length} linki jäi kontrollimata.`);

let checked = 0;
for (const ext of externals) {
  if (checked++ >= MAX_EXTERNAL) {
    report.limitations.push(`Välislinke oli rohkem kui ${MAX_EXTERNAL}, ülejäänud jäid kontrollimata.`);
    break;
  }
  let r = await get(ext, "HEAD");
  if (r.status === 405 || r.status === 501 || r.status === 0) r = await get(ext, "GET");
  if (r.status === 0 || r.status >= 400) {
    const unverified = [401, 403, 429, 999].includes(r.status);
    report.externalIssues.push({ url: ext, status: r.status, error: r.error, linkedFrom: referrers.get(ext) || null, note: unverified ? "kontrollimata (bot-blokk võimalik)" : "katki" });
  }
}

for (const b of report.brokenInternal) report.findings.push({ severity: "KÕRGE", url: b.url, issue: `sisemine link ei tööta (HTTP ${b.status || "võrguviga"})`, linkedFrom: b.linkedFrom });
for (const e of report.externalIssues.filter((x) => x.note === "katki")) report.findings.push({ severity: "KESKMINE", url: e.url, issue: `välislink ei tööta (HTTP ${e.status || "võrguviga"})`, linkedFrom: e.linkedFrom });

const order = { "KRIITILINE": 0, "KÕRGE": 1, "KESKMINE": 2, "MADAL": 3 };
report.findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

writeFileSync("site-check-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pagesChecked: report.pages.length, findings: report.findings.length, report }, null, 2));
