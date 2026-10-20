// Live-saidi tervisekontroll. Ei kasuta LLM-i (v.a. ühe lühikese päringuga Peetri otspunkti kaudu).
// Käivitus: node scripts/agents/health-check.mjs
// Keskkonnamuutujad: TARGET_URL (vaikimisi https://financedesign.ai)
// Väljund: JSON stdout-i, Markdown-kokkuvõte faili health.md. Väljumiskood 1, kui mõni kontroll ebaõnnestub.

import { writeFileSync } from "node:fs";

const TARGET = (process.env.TARGET_URL || "https://financedesign.ai").replace(/\/+$/, "");
const TIMEOUT_MS = 25000;

async function timed(url, init) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await r.text();
    return { status: r.status, contentType: r.headers.get("content-type") || "", text, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(fn) {
  try {
    return await fn();
  } catch (e1) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      return await fn();
    } catch (e2) {
      return { error: String(e2.message || e2) };
    }
  }
}

const checks = [
  {
    name: "Avaleht",
    run: async () => {
      const r = await timed(`${TARGET}/`);
      return r.status === 200 && /text\/html/.test(r.contentType) ? ok(r) : bad(r, `oodatud 200 HTML, tuli ${r.status}`);
    },
  },
  ...["/vke", "/ky", "/peeter", "/grants"].map((p) => ({
    name: `Leht ${p}`,
    run: async () => {
      const r = await timed(`${TARGET}${p}`);
      return r.status === 200 ? ok(r) : bad(r, `oodatud 200, tuli ${r.status}`);
    },
  })),
  {
    name: "API /api/grants",
    run: async () => {
      const r = await timed(`${TARGET}/api/grants`);
      if (r.status !== 200) return bad(r, `oodatud 200, tuli ${r.status}`);
      try {
        JSON.parse(r.text);
        return ok(r);
      } catch {
        return bad(r, "vastus ei ole JSON");
      }
    },
  },
  {
    name: "API /api/peeter-chat (Claude-ühendus)",
    run: async () => {
      const r = await timed(`${TARGET}/api/peeter-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Tere" }], documentTypeId: null, collected: {} }),
      });
      if (r.status !== 200) return bad(r, `oodatud 200, tuli ${r.status}: ${r.text.slice(0, 200)}`);
      try {
        const j = JSON.parse(r.text);
        return j.reply && String(j.reply).trim() ? ok(r) : bad(r, "vastuses puudub 'reply'");
      } catch {
        return bad(r, "vastus ei ole JSON");
      }
    },
  },
];

function ok(r) {
  return { ok: true, status: r.status, ms: r.ms };
}
function bad(r, detail) {
  return { ok: false, status: r.status, ms: r.ms, detail };
}

const results = [];
for (const c of checks) {
  const res = await attempt(c.run);
  results.push({ name: c.name, ...(res.error ? { ok: false, detail: `võrguviga: ${res.error}` } : res) });
}

const failed = results.filter((r) => !r.ok);
const md = [
  `Sihtmärk: ${TARGET}`,
  `Aeg: ${new Date().toISOString()}`,
  "",
  "| Kontroll | Tulemus | Detail |",
  "|---|---|---|",
  ...results.map((r) => `| ${r.name} | ${r.ok ? "OK" : "VIGA"} (${r.status ?? "–"}, ${r.ms ?? "–"} ms) | ${r.detail ?? ""} |`),
  "",
].join("\n");

writeFileSync("health.md", md);
console.log(JSON.stringify({ target: TARGET, failed: failed.length, results }, null, 2));
process.exit(failed.length > 0 ? 1 : 0);
