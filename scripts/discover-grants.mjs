#!/usr/bin/env node
// Otsib UUSI toetusmeetmeid (mida api/grants/data.json veel ei sisalda) viielt allikalt:
// EIS, RTK, PRIA, KIK, EL Funding & Tenders Portal (SEDIA).
// Erinevalt refresh-grants.mjs-ist (mis kontrollib TEADAOLEVATE kirjete värskust),
// see skript AVASTAB uusi kirjeid. Kõik leiud lähevad alati PR-i, mitte kunagi
// otse main-harusse (uue kirje asjakohasuse hindamine on riskantsem kui
// olemasoleva kirje kuupäeva uuendamine).
//
// Kahefaasiline arhitektuur:
//   Faas 1: odav loendamine (sitemap / nimekirjaleht) + üks Claude klassifikatsioonikõne
//           allika kohta (ainult pealkirjad/URL-id, mitte täislehed) -> lühinimekiri
//   Faas 2: ainult lühinimekirja kandidaatidele - täislehe laadimine (Playwright) +
//           Claude'iga täieliku kirje väljavõtmine, sama skeem mis data.json-is.
//
// Väljund: uued kandidaadid kirjutatakse api/grants/data.discovered.json faili
// (PR-i lisamiseks); GITHUB_OUTPUT: candidates_count, has_candidates, pr_body.

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DATA_PATH = path.join(process.cwd(), 'api/grants/data.json');
const DISCOVERED_PATH = path.join(process.cwd(), 'api/grants/data.discovered.json');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

if (!ANTHROPIC_API_KEY) {
  console.error('VIGA: ANTHROPIC_API_KEY puudub keskkonnamuutujates.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---------- Abifunktsioonid: brauseri kaudu laadimine ----------

async function withBrowser(fn) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: UA, locale: 'et-EE' });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function fetchRawViaPage(page, url, retries = 1) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.error('  Laadimine ebaonnestus (erand): ' + url + ' - ' + err.message);
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchRawViaPage(page, url, retries - 1);
    }
    return null;
  }
  if (!response || response.status() >= 400) {
    const status = response ? response.status() : 'none';
    const headers = response ? JSON.stringify(response.headers()) : '{}';
    console.error('  Laadimine ebaonnestus: ' + url + ' (HTTP ' + status + ') headers=' + headers);
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchRawViaPage(page, url, retries - 1);
    }
    return null;
  }
  await page.waitForTimeout(1500);
  const text = await response.text().catch(() => null);
  console.log('  Laaditud ' + url + ' (' + (text ? text.length : 0) + ' baiti)');
  return text;
}

async function fetchTextViaPage(page, url, waitMs = 3500, retries = 1) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.error('  Laadimine ebaonnestus (erand): ' + url + ' - ' + err.message);
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchTextViaPage(page, url, waitMs, retries - 1);
    }
    return null;
  }
  if (!response || response.status() >= 400) {
    console.error('  Laadimine ebaonnestus: ' + url + ' (HTTP ' + (response ? response.status() : 'none') + ')');
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchTextViaPage(page, url, waitMs, retries - 1);
    }
    return null;
  }
  await page.waitForTimeout(waitMs);
  return await page.innerText('body').catch(() => null);
}

async function fetchLinksViaPage(page, url, waitMs = 3500, retries = 1) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.error('  Laadimine ebaonnestus (erand): ' + url + ' - ' + err.message);
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchLinksViaPage(page, url, waitMs, retries - 1);
    }
    return [];
  }
  if (!response || response.status() >= 400) {
    console.error('  Laadimine ebaonnestus: ' + url + ' (HTTP ' + (response ? response.status() : 'none') + ')');
    if (retries > 0) {
      await page.waitForTimeout(3000);
      return fetchLinksViaPage(page, url, waitMs, retries - 1);
    }
    return [];
  }
  await page.waitForTimeout(waitMs);
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      href: a.href,
      text: a.textContent.replace(/\s+/g, ' ').trim(),
    }))
  );
}

// ---------- Faas 1: allikapõhine loendamine ----------
// Iga funktsioon tagastab: [{ source, title, url, statusHint }]

async function enumerateEis(page) {
    const xml = await fetchRawViaPage(page, 'https://eis.ee/teenus-sitemap.xml');
    if (!xml) return [];
    // 2026-09-14 diagnostika: reaalsest brauserist (mitte GitHub Actionsi runnerilt)
    // laaditud sitemap on 228 <loc> kirjega, ~31KB, algab "<?xml version..." paringuga
    // ilma erilise User-Agent'ita voi peatega. GitHub Actionsi runnerilt tuli varem
    // HTTP 200 vastus, mis oli 44KB ja sisaldas 0 <loc> kirjet - see viitab, et
    // eis.ee tuvastab Actionsi andmekeskuse IP-vahemiku ja tagastab reaalse sitemapi
    // asemel mingi vahelehe (boti tuvastus / valjakutse), ilma HTTP veakoodita.
    // See EI ole regexi ega parsimise viga - see on infrastruktuuri tasandi
    // blokeering, mida skriptist ei saa parandada. Allolev kontroll ei "paranda"
    // seda, vaid muudab tulevased ebaonnestumised diagnoositavaks (varem oli
    // vaikimisi tulemus "0 kirjet" ilma pohjuseta).
    if (!xml.includes('<loc>')) {
          console.error(
                  '  EIS HOIATUS: vastus ei sisalda uhtegi <loc> silti (' +
                    xml.length +
                    ' baiti) - toenaoliselt boti-tuvastus/valjakutse lehekylg, mitte tegelik sitemap. ' +
                    'Esimesed 200 marki: ' +
                    xml.slice(0, 200).replace(/\s+/g, ' ')
                );
          return [];
    }
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const seen = new Set();
    const out = [];
    for (const u of urls) {
          if (u.includes('/en/services/') || u.includes('/ru/uslugi/')) continue;
          if (!u.includes('/teenused/')) continue;
          if (seen.has(u)) continue;
          seen.add(u);
          const slug = u.split('/').filter(Boolean).pop() || u;
          out.push({ source: 'EIS', title: slug.replace(/-/g, ' '), url: u, statusHint: 'unknown' });
    }
    return out;
}

async function enumerateRtk(page) {
  const links = await fetchLinksViaPage(
    page,
    'https://www.rtk.ee/toetused-taotlemine/taotlusvoorud/avatud-ja-suletud-taotlusvoorud',
    4000
  );
  const out = [];
  const seen = new Set();
  for (const l of links) {
    if (!/rtk\.ee\//.test(l.href)) continue;
    if (!l.text || l.text.length < 8) continue;
    if (/taotlusvoorud|avatud-ja-suletud|toetused-taotlemine\/?$|prognoos|logod|plakatigeneraator/.test(l.href)) continue;
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    out.push({ source: 'RTK', title: l.text, url: l.href, statusHint: 'open_or_soon' });
  }
  return out;
}

async function enumeratePria(page) {
  const links = await fetchLinksViaPage(page, 'https://www.pria.ee/toetused', 4000);
  const out = [];
  const seen = new Set();
  for (const l of links) {
    if (!/pria\.ee\/toetus\//.test(l.href) && !/pria\.ee\/toetused\//.test(l.href)) continue;
    if (!l.text || l.text.length < 8) continue;
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    out.push({ source: 'PRIA', title: l.text, url: l.href, statusHint: 'unknown' });
  }
  return out;
}

async function enumerateKik(page) {
  const links = await fetchLinksViaPage(page, 'https://kik.ee/et/toetatavad-tegevused', 4000);
  const out = [];
  const seen = new Set();
  for (const l of links) {
    if (!/kik\.ee\/et\/toetatavad-tegevused\//.test(l.href)) continue;
    if (!l.text || l.text.length < 8) continue;
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    out.push({ source: 'KIK', title: l.text, url: l.href, statusHint: 'unknown' });
  }
  return out;
}

async function enumerateEuPortal(page) {
    // 2026-09-14 diagnostika (Playwright kaudu paringute testimine reaalses brauseris,
    // mitte GitHub Actions runnerilt): endine multipart/form-data + DATASOURCE=SEDIA
    // kuju tagastas HTTP 500 "An internal error occurred" ka reaalsest brauserist
    // paringuna - see EI OLNUD IP/bot-blokeering, vaid vale paringu kuju. Portaali
    // enda otsing (vaadeldud vorgupaneelist) saadab lihtsa JSON body kujul paringu:
    // POST .../search?apiKey=SEDIA&text=...&pageSize=...&pageNumber=... ,
    // Content-Type: application/json, body: {"query": {...}}.
    //
    // TEADMATA (andmed puuduvad): reaalse "query" filtri DSL (mis filtreerib
    // avatud/eelseisvad "calls for proposals" kirjed) - testitud bool/must/terms
    // kujud (type/status vaelja nimedega) EI mojuta totalResults-i uldse (API
    // eirab tundmatut struktuuri vaikimisi, tagastab kogu andmebaasi vaste).
    // Uldine tekstiotsing "***" voi vabateksti margasonadega ei taba topic-details
    // kirjeid (avatud tooetusmeetmeid) - need paistavad vajavat spetsiifilist,
    // dokumenteerimata paringu struktuuri, mida ei onnestunud reaalse kasutaja
    // brauseripaeringu body't puudutamata tuvastada (vorgumonitor ei nayta POST
    // body't). Seega allpool olev fix kaotab HTTP 500 crashi, kuid EI taga
    // sisuliselt kasutatavaid tulemusi - filtreerimine jaab lahendamata kuni
    // keegi saab kaette EU portaali enda paringu tegeliku body (nt DevTools
    // Network tab käsitsi + "Copy as fetch").
    await page.goto('https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
    }).catch(() => null);
    await page.waitForTimeout(1500);

    const result = await page.evaluate(async () => {
          try {
                  const query = {
                            bool: {
                                        must: [
                                          { terms: { type: ['1'] } },
                                          { terms: { status: ['31094501', '31094502'] } },
                                                    ],
                            },
                  };
                  const res = await fetch(
                            'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=%22***%22&pageSize=100&pageNumber=1',
                    {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ query }),
                    }
                          );
                  if (!res.ok) {
                            const bodyText = await res.text().catch(() => '');
                            return { error: 'HTTP ' + res.status + ' body=' + bodyText.slice(0, 300) };
                  }
                  const json = await res.json();
                  return { results: json.results || [], totalResults: json.totalResults };
          } catch (err) {
                  return { error: String(err) };
          }
    });

    if (result.error) {
          console.error('  EL portaali paring ebaonnestus: ' + result.error);
          return [];
    }
    if (result.totalResults && result.totalResults > 100000) {
          console.error(
                  '  EL portaali paring HOIATUS: query-filter ei toiminud (totalResults=' +
                    result.totalResults +
                    ', tagastati filtreerimata koguandmebaas). Kandidaate ei loendata seni, kuni filtri DSL on kinnitatud.'
                );
          return [];
    }
    const out = [];
    for (const r of result.results || []) {
          if (!r.url || !r.url.includes('/topic-details/')) continue;
          const m = r.metadata || {};
          const title = Array.isArray(m.title) ? m.title[0] : m.title;
          if (!title) continue;
          out.push({ source: 'EL_PORTAL', title, url: r.url, statusHint: 'open' });
    }
    return out;
}

// ---------- Anthropic API abifunktsioonid ----------

async function callClaude(prompt, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('Anthropic API viga: HTTP ' + res.status + ' ' + errText.slice(0, 500));
  }
  const json = await res.json();
  const text = (json.content || []).map((c) => c.text || '').join('');
  return text;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function classifyCandidates(source, candidates, existingUrls) {
  const fresh = candidates.filter((c) => !existingUrls.has(c.url));
  if (fresh.length === 0) return [];

  const listing = fresh
    .map((c, i) => `${i}. "${c.title}" -> ${c.url}`)
    .join('\n');

  const prompt = `Sa hindad Eesti toetusmeetmete/rahastusvõimaluste nimekirja allikast "${source}".
Eesmärk: leida meetmed, mis on TÕENÄOLISELT asjakohased kas
(a) Eesti väikese/keskmise ettevõtte (VKE) jaoks (nt käibevahend, seadmed, ekspordi arendus, tootearendus, energiatõhusus ettevõttele, digitaliseerimine) või
(b) Eesti korteriühistu (KÜ) jaoks (nt hoone renoveerimine, energiatõhusus, kortermaja rekonstrueerimine, küttesüsteemid, elamufondi toetused).

EI HUVITA: teadusasutuste/ülikoolide toetused, riigiasutuste/KOV-i haldustoetused, põllumajandustootja-spetsiifilised toetused (v.a kui sõnaselgelt puudutab ka väikeettevõtjat üldiselt, mitte ainult põllumajandussektorit), kalandus- ja vesiviljelussektori-spetsiifilised toetused (kalalaevad, kalapüügiluba, vesiviljeluskasvandused, kalatöötlemine), muud kitsalt ühe tegevusloa/tegevusala taha piiratud niši-sektori toetused (nt laevandus, mäetööstus), suured EL-i teadus-konsortsiumi hanked, eraisiku (mitte-ettevõtja, mitte-KÜ) toetused, sotsiaaltoetused. Kui toetuse taotlejaks saab olla IGA ettevõtja mistahes tegevusalal, on see asjakohane; kui taotlejaks saab olla vaid ühe kindla sektori tegevusloaga ettevõtja, on see EI HUVITA.

Nimekiri (indeks. "pealkiri" -> URL):
${listing}

Vasta AINULT JSON massiivina, ilma lisatekstita, kujul:
[{"index": <number>, "segment": "VKE" | "KY" | "MOLEMAD", "reason": "<lühipõhjendus eesti keeles, max 15 sõna>"}]

Kui ükski pole asjakohane, vasta tühja massiiviga [].`;

  let raw;
  try {
    raw = await callClaude(prompt, 1500);
  } catch (err) {
    console.error('  Klassifikatsioon ebaonnestus (' + source + '): ' + err.message);
    return [];
  }
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) return [];

  const out = [];
  for (const item of parsed) {
    const idx = item.index;
    if (typeof idx !== 'number' || !fresh[idx]) continue;
    out.push({ ...fresh[idx], segment: item.segment, reason: item.reason });
  }
  return out;
}

// ---------- Faas 2: täiskirje väljavõtmine lühinimekirja kandidaatidele ----------

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function extractFullRecord(page, candidate) {
  const text = await fetchTextViaPage(page, candidate.url, 4000);
  if (!text) return null;

  const segment =
    candidate.segment === 'VKE' ? 'vke' : candidate.segment === 'KY' ? 'ky' : 'vke,ky';

  const prompt = `Sa võtad välja struktureeritud toetusmeetme andmed Eesti allika lehelt.
Allikas: ${candidate.source}
URL: ${candidate.url}
Eeldatav sihtsegment: ${segment}

Lehe tekst (kärbitud):
${text.slice(0, 12000)}

Väljasta AINULT JSON objekt (ilma markdown-koodiplokita), täpselt selle struktuuriga:
{
  "id": "<lühike ingliskeelne kebab-case id, nt eis-uus-meede>",
  "name": "<meetme nimi eesti keeles>",
  "provider": "<asutuse nimi, nt EIS / RTK / PRIA / KIK / Euroopa Komisjon>",
  "target_segment": "<vke | ky | vke,ky>",
  "status": "<open | upcoming | closed>",
  "round_opens": "<YYYY-MM-DD või null kui pole teada>",
  "round_closes": "<YYYY-MM-DD või null kui pole teada>",
  "round_notes": "<lühimärkus vooru kohta või tühi string>",
  "max_amount_eur": <number või null>,
  "funding_rate": "<nt \\"70%\\" või tühi string kui pole teada>",
  "requirements": ["<nõue1>", "<nõue2>"],
  "description": "<1-2 lauset eesti keeles>",
  "source_url": "${candidate.url}",
  "last_verified": "${today}"
}

Kui mõni väli pole lehelt tuvastatav, kasuta null (numbrite/kuupäevade puhul) või tühja stringi/massiivi. ÄRA VÄLJAMÕTLE andmeid.
max_amount_eur peab olema toetuse maksimaalne summa TÄISELT EURODES (mitte tuhandetes, mitte protsent, mitte pindala- või ühikuhind). Kui lehel on ainult ühikuhind (nt "eurot/m2" või "eurot/kW") või eelarve on toodud ilma selge ülempiirita ühe taotluse kohta, kasuta null. Ära väljasta väärtust, mis on alla 1000, välja arvatud juhul, kui leht sõnaselgelt kinnitab, et see ongi maksimaalne toetussumma taotluse kohta.`;

  let raw;
  try {
    raw = await callClaude(prompt, 1200);
  } catch (err) {
    console.error('  Täiskirje väljavõtmine ebaonnestus (' + candidate.url + '): ' + err.message);
    return null;
  }
  const parsed = extractJson(raw);
  if (!parsed || !parsed.name) return null;
  if (!parsed.id) parsed.id = slugify(candidate.source + '-' + parsed.name);
  parsed.source_url = candidate.url;
  parsed.last_verified = today;
  return parsed;
}

// ---------- Peafunktsioon ----------

async function main() {
  const existingRaw = await fs.readFile(DATA_PATH, 'utf-8');
  const existing = JSON.parse(existingRaw);
  const existingUrls = new Set(existing.map((g) => g.source_url));

  const enumerators = [
    { name: 'EIS', fn: enumerateEis },
    { name: 'RTK', fn: enumerateRtk },
    { name: 'PRIA', fn: enumeratePria },
    { name: 'KIK', fn: enumerateKik },
    { name: 'EL_PORTAL', fn: enumerateEuPortal },
  ];

  const allCandidates = [];
  await withBrowser(async (page) => {
    for (const { name, fn } of enumerators) {
      console.log('Loendan allikat: ' + name);
      try {
        const found = await fn(page);
        console.log('  Leitud ' + found.length + ' kirjet.');
        allCandidates.push(...found);
      } catch (err) {
        console.error('  Loendamine ebaonnestus (' + name + '): ' + err.message);
      }
    }
  });

  console.log('\nKokku loendatud: ' + allCandidates.length + ', neist uued (mitte data.json-is): ' +
    allCandidates.filter((c) => !existingUrls.has(c.url)).length);

  const shortlist = [];
  for (const { name } of enumerators) {
    const sourceCandidates = allCandidates.filter((c) => c.source === name);
    if (sourceCandidates.length === 0) continue;
    console.log('\nKlassifitseerin allikat: ' + name + ' (' + sourceCandidates.length + ' kandidaati)');
    const relevant = await classifyCandidates(name, sourceCandidates, existingUrls);
    console.log('  Asjakohaseid leide: ' + relevant.length);
    shortlist.push(...relevant);
  }

  console.log('\nKokku lühinimekirjas: ' + shortlist.length);

  const discovered = [];
  if (shortlist.length > 0) {
    await withBrowser(async (page) => {
      for (const candidate of shortlist) {
        console.log('Väljavõtmine: ' + candidate.title + ' (' + candidate.url + ')');
        const record = await extractFullRecord(page, candidate);
        if (record) {
          discovered.push({ ...record, _discovery_reason: candidate.reason, _discovery_segment: candidate.segment });
        }
      }
    });
  }

  await fs.writeFile(DISCOVERED_PATH, JSON.stringify(discovered, null, 2) + '\n', 'utf-8');
  console.log('\nKirjutatud ' + discovered.length + ' uut kandidaati faili ' + DISCOVERED_PATH);

  const hasCandidates = discovered.length > 0;
  let prBody = '## Avastatud uued toetusmeetme kandidaadid\n\n';
  prBody += 'Automaatselt leitud ' + discovered.length + ' potentsiaalselt asjakohast uut kirjet, mida api/grants/data.json veel ei sisalda.\n\n';
  prBody += '**OLULINE:** need kirjed on AI poolt väljavõetud ja klassifitseeritud - vajavad käsitsi ülevaatust ja allika kontrolli enne avaldamist. Ükski kirje ei ole automaatselt data.json faili lisatud.\n\n';
  for (const d of discovered) {
    prBody += '- **' + d.name + '** (' + d.provider + ', ' + d._discovery_segment + ') - ' + d.source_url + '\n';
    prBody += '  - Pohjus: ' + d._discovery_reason + '\n';
  }
  if (!hasCandidates) {
    prBody += 'Uusi asjakohaseid kandidaate ei leitud selles käigus.\n';
  }

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const lines = [
      'has_candidates=' + (hasCandidates ? 'true' : 'false'),
      'candidates_count=' + discovered.length,
      'pr_body<<GRANTS_DISCOVER_EOF',
      prBody,
      'GRANTS_DISCOVER_EOF',
      '',
    ].join('\n');
    await fs.appendFile(githubOutput, lines);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
