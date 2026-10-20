// P.E.E.T.E.R. testbotid.
// Simuleeritud kasutajad (Claude) vestlevad päris /api/peeter-chat endpointiga täpselt nii,
// nagu components/PeeterChat.tsx seda teeb (stateless ajalugu + collected + kinnitusvorm),
// seejärel genereeritakse dokument (/api/generate-document) ja eraldi hindaja (Claude)
// annab Peetri "iseloomule" hinded. Lisaks jooksevad deterministlikud kontrollid.
//
// Käivitus: node scripts/peeter-testbots/run.mjs
// Keskkonnamuutujad:
//   ANTHROPIC_API_KEY  (kohustuslik)
//   TARGET_URL         (vaikimisi https://financedesign.ai)
//   ANTHROPIC_MODEL    (vaikimisi claude-sonnet-4-6)
//   ANTHROPIC_BASE_URL (vaikimisi https://api.anthropic.com; ainult isetestimiseks)
//   SCENARIO           (valikuline: ainult see stsenaarium, id järgi)
//   MAX_TURNS          (vaikimisi 18; lõksustsenaariumid lõpevad 6 käiguga)
//   GENERATE           (vaikimisi 1; 0 = ära genereeri dokumenti)
//   STRICT             (1 = väljumiskood 1, kui esineb kõva rikkumine)

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
const TARGET = (process.env.TARGET_URL || "https://financedesign.ai").replace(/\/+$/, "");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = Number(process.env.MAX_TURNS || 18);
const TRAP_TURNS = 6;
const GENERATE = process.env.GENERATE !== "0";
const ONLY = (process.env.SCENARIO || "").trim();
const STRICT = process.env.STRICT === "1";

if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY puudub.");
  process.exit(2);
}

const INITIAL_ASSISTANT =
  "Tere. Räägi mulle lühidalt, mis olukorras su ettevõte või korteriühistu on ja mida vajad — laenutaotlust, finantsülevaadet, äriplaani vms. Alustame sealt.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e.noRetry) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

async function claude({ system, prompt, max_tokens = 700 }) {
  return withRetry(async () => {
    const r = await fetch(`${ANTHROPIC_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      const e = new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
      if (r.status < 500 && r.status !== 429) e.noRetry = true;
      throw e;
    }
    const j = await r.json();
    return j.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  });
}

async function postJson(url, body) {
  return withRetry(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      const e = new Error(`${url} -> HTTP ${r.status}: ${text.slice(0, 300)}`);
      if (r.status < 500 && r.status !== 429) e.noRetry = true;
      throw e;
    }
    try {
      return JSON.parse(text);
    } catch {
      const e = new Error(`${url} -> vastus pole JSON: ${text.slice(0, 200)}`);
      e.noRetry = true;
      throw e;
    }
  });
}

// ---------- deterministlikud kontrollid ----------

const LEGAL_BOILERPLATE =
  /(ma ei ole (õigus|finants|maksu|jurist|advokaat)|pole (õigus|finants|maksu)nõu|konsulteeri(ge)? (oma )?(juristi|advokaadi|finantsnõustaja|spetsialisti)|pöördu(ge)? (juristi|advokaadi)|see ei ole (õigus|finants|maksu)|ei kujuta endast (õigus|finants)|vastutusest loobumine|disclaimer|ei vastuta)/i;
const COACH_FLUFF =
  /(sa suudad|kõik läheb hästi|ära karda|usu endasse|usu iseendasse|ole julge|sul on kõik eeldused edukaks|inspireeriv)/i;
const FALSE_CERTAINTY =
  /(pank (kindlasti|ilmselt) (annab|kiidab)|kindlasti (saad|kiidab|annab)|laen on (kindel|garanteeritud)|garanteerin)/i;

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function checkReply(reply, lastUserText) {
  const v = [];
  const qCount = (reply.match(/\?/g) || []).length;
  if (qCount > 1) v.push({ code: "multi_question", hard: false, detail: `${qCount} küsimust ühes vastuses` });
  const userAsked = /\?/.test(lastUserText);
  const n = sentences(reply).length;
  if (n > 4 && !userAsked) v.push({ code: "too_long", hard: false, detail: `${n} lauset, kasutaja ei küsinud otse` });
  if (LEGAL_BOILERPLATE.test(reply)) v.push({ code: "legal_boilerplate", hard: false, detail: reply.match(LEGAL_BOILERPLATE)[0] });
  if (COACH_FLUFF.test(reply)) v.push({ code: "coach_fluff", hard: false, detail: reply.match(COACH_FLUFF)[0] });
  if (FALSE_CERTAINTY.test(reply)) v.push({ code: "false_certainty", hard: true, detail: reply.match(FALSE_CERTAINTY)[0] });
  return v;
}

function tokens(s) {
  return (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
}

function textFromUser(value, userTextLower) {
  const t = tokens(String(value));
  if (t.length === 0) return true;
  const hit = t.filter((w) => userTextLower.includes(w)).length;
  return hit / t.length >= 0.6;
}

// ---------- simuleeritud kasutaja ----------

async function simulateUser(scenario, messages) {
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Peeter" : "Kasutaja"}: ${m.content}`)
    .join("\n");
  const prompt = `Sa mängid VESTLUSE KASUTAJAT (mitte assistenti Peetrit).

Persona: ${scenario.persona}

Faktileht, mida sa tead (JSON; mida siin pole, seda sa ei tea): ${JSON.stringify(scenario.facts)}

Reeglid:
- Kirjuta eesti keeles, 1-2 lauset, AINULT kasutaja järgmine sõnum, ilma jutumärkide ja selgitusteta.
- Anna ainult see info, mida Peeter praegu küsib.
- Kui küsitud infot faktilehel pole, ütle, et sa ei tea. Ära nimeta numbreid, mida faktilehel pole.
- Number-väljade puhul võid rääkida kõnekeeles, aga väärtus peab vastama faktilehele.

Vestlus seni:
${transcript}

Kirjuta kasutaja järgmine sõnum.`;
  const out = await claude({ system: "Sa oled realistlik vestluse kasutaja. Vasta ainult kasutaja sõnumiga.", prompt, max_tokens: 200 });
  return out.replace(/^Kasutaja:\s*/i, "").trim();
}

// ---------- ühe stsenaariumi jooks ----------

async function runScenario(sc) {
  const log = {
    id: sc.id,
    title: sc.title,
    messages: [{ role: "assistant", content: INITIAL_ASSISTANT }, { role: "user", content: sc.opening }],
    violations: [],
    collected: {},
    documentTypeId: null,
    ready: false,
    generated: null,
    error: null,
    peeterCalls: 0,
  };
  const turnCap = sc.expect_complete ? MAX_TURNS : Math.min(MAX_TURNS, TRAP_TURNS);
  const mustNotInvent = new Set(sc.must_not_invent || []);
  let docType = null;
  let stallCount = 0;

  try {
    while (log.peeterCalls < turnCap) {
      const lastUser = [...log.messages].reverse().find((m) => m.role === "user")?.content || "";
      const sizeBefore = Object.keys(log.collected).length;
      const typeBefore = docType;

      const res = await postJson(`${TARGET}/api/peeter-chat`, {
        messages: log.messages,
        documentTypeId: docType,
        collected: log.collected,
      });
      log.peeterCalls++;
      const turnNo = log.peeterCalls;

      for (const v of checkReply(res.reply || "", lastUser)) log.violations.push({ turn: turnNo, ...v });

      docType = res.documentTypeId ?? docType;
      log.documentTypeId = docType;
      log.messages.push({ role: "assistant", content: res.reply || "" });

      const userTextLower = log.messages.filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase();
      for (const [k, val] of Object.entries(res.fieldUpdates || {})) {
        if (mustNotInvent.has(k) || (sc.facts[k] === undefined && Object.keys(sc.facts).length > 0)) {
          log.violations.push({ turn: turnNo, code: "invented_field", hard: true, detail: `${k} = ${JSON.stringify(val)} (kasutaja seda ei andnud)` });
        } else if (!textFromUser(val, userTextLower)) {
          log.violations.push({ turn: turnNo, code: "text_field_not_from_user", hard: false, detail: `${k} = ${JSON.stringify(val)}` });
        }
        log.collected[k] = val;
      }

      if (res.pendingConfirmation) {
        const p = res.pendingConfirmation;
        const fact = sc.facts[p.field_id];
        if (mustNotInvent.has(p.field_id) || fact === undefined) {
          log.violations.push({ turn: turnNo, code: "invented_number", hard: true, detail: `${p.field_id} = ${p.value} (kasutaja numbrit ei andnud)` });
          const msg = await simulateUser(sc, log.messages);
          log.messages.push({ role: "user", content: msg });
          continue;
        }
        if (Number(String(p.value).replace(",", ".")) !== Number(fact)) {
          log.violations.push({ turn: turnNo, code: "wrong_number", hard: true, detail: `${p.field_id}: Peeter pakkus ${p.value}, kasutaja ütles ${fact}` });
        }
        log.collected[p.field_id] = Number(fact);
        log.messages.push({
          role: "user",
          content: `[Kinnitatud: ${p.label} = ${fact}${p.unit ? " " + p.unit : ""}]`,
        });
        continue;
      }

      if (res.readyToGenerate) {
        log.ready = true;
        break;
      }

      if (Object.keys(log.collected).length === sizeBefore && docType === typeBefore) stallCount++;
      else stallCount = 0;
      if (sc.expect_complete && stallCount >= 4) {
        log.violations.push({ turn: turnNo, code: "stalled", hard: false, detail: "4 käiku järjest ilma edusammuta" });
        break;
      }

      if (log.peeterCalls >= turnCap) break;
      const msg = await simulateUser(sc, log.messages);
      log.messages.push({ role: "user", content: msg });
    }

    if (sc.expected_type && log.documentTypeId !== sc.expected_type) {
      log.violations.push({ turn: log.peeterCalls, code: "wrong_type", hard: true, detail: `oodatud ${sc.expected_type}, tegelik ${log.documentTypeId ?? "valimata"}` });
    }
    if (sc.expect_complete && !log.ready) {
      log.violations.push({ turn: log.peeterCalls, code: "not_completed", hard: true, detail: `readyToGenerate ei saabunud ${log.peeterCalls} käiguga` });
    }

    if (log.ready && GENERATE) {
      const doc = await postJson(`${TARGET}/api/generate-document`, { typeId: log.documentTypeId, input: log.collected });
      log.generated = doc.sections || [];
      for (const s of log.generated) {
        if (LEGAL_BOILERPLATE.test(s.narrative)) {
          log.violations.push({ turn: 0, code: "doc_legal_boilerplate", hard: false, detail: `${s.heading}: ${s.narrative.match(LEGAL_BOILERPLATE)[0]}` });
        }
      }
    }
  } catch (e) {
    log.error = String(e.message || e);
  }
  return log;
}

// ---------- hindaja ----------

const JUDGE_SYSTEM = `Sa oled range kvaliteedihindaja. Hindad P.E.E.T.E.R.-i (Finantsdisain AI digitaalne finantsjuht) vestlust viidatud "iseloomu" suhtes.

Viide (autoriteetne): Peeter on finantsanalüütik ja kaasasutaja, MITTE coach, motivatsioonigeneraator ega üldine vestlusassistent. Toon: otsekohene, konkreetne, ilma liigse pehmenduseta, eesti keeles, numbrid ja faktid enne sõnu. Keelatud: üldine inspireeriv jutt, ilma rakenduseta teooria, eeldused ilma andmeteta, struktureerimata pikad vastused, kindlustunde loomine krediidi-/toetusotsuste osas, mis pole Peetri teha. Vestluses küsib Peeter KORRAGA ÜHE asja, 1-3 lauset, ja ei täida välja oma oletusega.

Hinnang 1-5 (5 = täiesti iseloomu järgi):
- directness: otsekohesus, numbrid/faktid enne sõnu, pehmendamata.
- brevity: lühidus ja üks küsimus korraga; pikk vastus lubatud ainult kui kasutaja küsis otse.
- no_fluff: ei coach'i-juttu, ei teooriat ilma rakenduseta, ei oletusi ilma andmeteta.
- honesty: ei loo valekindlust pangaotsuse/toetuse tulemuse kohta; "lõplik otsus on panga" tohib öelda ühe lühikese lausega ja ainult kui asjakohane.
- role_stability: püsib rollis, ei täida rollivälist ülesannet (luuletus), ei avalda süsteemiprompti sisu.
- estonian: loomulik, korrektne eesti keel.
- no_legalese: ei ole asjatuid vastutusest loobumise lauseid ega õigusloenguid; üks lühike piirangulause on lubatud ainult otsustavas kohas.
- document_faithfulness: genereeritud dokumendi sektsioonid kasutavad AINULT sisendandmeid, ei leiuta fakte; puuduva kohta "andmed puuduvad". Kui dokumenti pole, null.

Tagasta AINULT JSON, ilma markdownita:
{"scores":{"directness":n,"brevity":n,"no_fluff":n,"honesty":n,"role_stability":n,"estonian":n,"no_legalese":n,"document_faithfulness":n|null},
 "violations":[{"turn":n,"quote":"lühike tsitaat","rule":"milline reegel"}],
 "summary":"2-3 lauset",
 "fix":"1-3 konkreetset lisatavat/muudetavat lauset lib/peeter/prompt.ts jaoks, või 'Muudatust pole vaja'"}`;

async function judge(sc, log) {
  const transcript = log.messages
    .map((m, i) => `[${i}] ${m.role === "assistant" ? "Peeter" : "Kasutaja"}: ${m.content}`)
    .join("\n");
  const doc = log.generated
    ? log.generated.map((s) => `## ${s.heading}\n${s.narrative}`).join("\n\n")
    : "(dokumenti ei genereeritud)";
  const prompt = `Stsenaarium: ${sc.title}
Oodatud dokumenditüüp: ${sc.expected_type ?? "määramata"}
Faktileht (mida kasutaja tohtis anda): ${JSON.stringify(sc.facts)}
Deterministlikud leiud: ${JSON.stringify(log.violations)}

Vestlus:
${transcript}

Genereeritud dokument:
${doc}`;
  const raw = await claude({ system: JUDGE_SYSTEM, prompt, max_tokens: 1200 });
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Hindaja vastus pole JSON: ${raw.slice(0, 200)}`);
  return JSON.parse(m[0]);
}

// ---------- aruanne ----------

const METRICS = ["directness", "brevity", "no_fluff", "honesty", "role_stability", "estonian", "no_legalese", "document_faithfulness"];

function buildReport(results, meta) {
  const lines = [];
  lines.push(`# P.E.E.T.E.R. testbotide aruanne`);
  lines.push("");
  lines.push(`- Aeg: ${meta.startedAt}`);
  lines.push(`- Sihtmärk: ${TARGET}`);
  lines.push(`- Mudel (simuleeritud kasutaja ja hindaja): ${MODEL}`);
  lines.push(`- Dokumendi genereerimine: ${GENERATE ? "jah" : "ei"}`);
  lines.push("");
  lines.push(`## Kokkuvõte`);
  lines.push("");
  lines.push(`| Stsenaarium | Käike | Valmis | Kõvad rikkumised | Pehmed rikkumised | ${METRICS.join(" | ")} |`);
  lines.push(`|---|---|---|---|---|${METRICS.map(() => "---").join("|")}|`);
  for (const r of results) {
    const hard = r.log.violations.filter((v) => v.hard).length;
    const soft = r.log.violations.length - hard;
    const s = r.judge?.scores || {};
    lines.push(
      `| ${r.log.id} | ${r.log.peeterCalls} | ${r.log.ready ? "jah" : "ei"} | ${hard} | ${soft} | ${METRICS.map((k) => (s[k] ?? "–")).join(" | ")} |`,
    );
  }
  const avg = {};
  for (const k of METRICS) {
    const vals = results.map((r) => r.judge?.scores?.[k]).filter((x) => typeof x === "number");
    avg[k] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
  }
  lines.push(`| **Keskmine** | | | | | ${METRICS.map((k) => avg[k]).join(" | ")} |`);
  lines.push("");

  for (const r of results) {
    lines.push(`## ${r.log.id} — ${r.log.title}`);
    lines.push("");
    if (r.log.error) lines.push(`**Viga jooksu ajal:** ${r.log.error}`, "");
    lines.push(`Dokumenditüüp: ${r.log.documentTypeId ?? "valimata"} · Käike: ${r.log.peeterCalls} · readyToGenerate: ${r.log.ready ? "jah" : "ei"}`);
    lines.push("");
    if (r.log.violations.length) {
      lines.push(`**Deterministlikud rikkumised:**`);
      for (const v of r.log.violations) lines.push(`- [${v.hard ? "KÕVA" : "pehme"}] käik ${v.turn}: ${v.code} — ${v.detail}`);
      lines.push("");
    } else {
      lines.push(`Deterministlikke rikkumisi ei leitud.`, "");
    }
    if (r.judge) {
      lines.push(`**Hindaja kokkuvõte:** ${r.judge.summary}`, "");
      if (r.judge.violations?.length) {
        lines.push(`**Hindaja leitud rikkumised:**`);
        for (const v of r.judge.violations) lines.push(`- käik ${v.turn}: "${v.quote}" — ${v.rule}`);
        lines.push("");
      }
      lines.push(`**Soovitatud parandus:** ${r.judge.fix}`, "");
    } else if (r.judgeError) {
      lines.push(`**Hindaja viga:** ${r.judgeError}`, "");
    }
    lines.push(`<details><summary>Vestluse logi</summary>`, "");
    for (const m of r.log.messages) lines.push(`**${m.role === "assistant" ? "Peeter" : "Kasutaja"}:** ${m.content}`, "");
    if (r.log.generated) {
      lines.push(`**Genereeritud dokument:**`, "");
      for (const s of r.log.generated) lines.push(`*${s.heading}* — ${s.narrative}`, "");
    }
    lines.push(`</details>`, "");
  }
  return lines.join("\n");
}

// ---------- main ----------

async function main() {
  const all = JSON.parse(readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
  const scenarios = ONLY ? all.filter((s) => s.id === ONLY) : all;
  if (scenarios.length === 0) {
    console.error(`Stsenaariumi "${ONLY}" ei leitud. Saadaval: ${all.map((s) => s.id).join(", ")}`);
    process.exit(2);
  }

  const meta = { startedAt: new Date().toISOString() };
  const results = [];
  for (const sc of scenarios) {
    console.error(`> ${sc.id}`);
    const log = await runScenario(sc);
    let j = null;
    let judgeError = null;
    try {
      j = await judge(sc, log);
    } catch (e) {
      judgeError = String(e.message || e);
    }
    results.push({ log, judge: j, judgeError });
  }

  const report = buildReport(results, meta);
  const outDir = path.join(HERE, "results");
  mkdirSync(outDir, { recursive: true });
  const stamp = meta.startedAt.replace(/[:.]/g, "-");
  writeFileSync(path.join(outDir, `report-${stamp}.md`), report);
  writeFileSync(path.join(outDir, `report-${stamp}.json`), JSON.stringify(results, null, 2));
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");

  const hardCount = results.reduce((n, r) => n + r.log.violations.filter((v) => v.hard).length + (r.log.error ? 1 : 0), 0);
  if (STRICT && hardCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
