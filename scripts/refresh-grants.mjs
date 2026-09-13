#!/usr/bin/env node
// Kontrollib api/grants/data.json kirjete allikaid (source_url) ja uuendab andmed.
// Kasutab Playwright headless Chromiumit (mitte fetch), kuna allikad (eis.ee, rtk.ee)
// blokeerivad lihtsaid HTTP paringuid (403 Forbidden / bot-tõrje).
// Valjund: GITHUB_OUTPUT muutujad any_change, material_change, pr_body.

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DATA_PATH = path.join(process.cwd(), 'api/grants/data.json');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY puudub - katkestan.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

async function fetchSourceText(url) {
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      locale: 'et-EE',
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    const status = response ? response.status() : null;
    if (!response || status >= 400) {
      console.error('Fetch ebaonnestus (' + url + '): HTTP ' + status);
      await browser.close();
      return null;
    }
    const text = await page.innerText('body').catch(() => null);
    await browser.close();
    if (!text || text.length < 200) {
      console.error('Fetch andis liiga vahe sisu (' + url + '): ' + (text ? text.length : 0) + ' marki');
      return null;
    }
    console.log('Laetud ' + url + ' - ' + text.length + ' marki teksti (HTTP ' + status + ')');
    return text.replace(/\s+/g, ' ').trim().slice(0, 15000);
  } catch (err) {
    console.error('Fetch viga (' + url + '): ' + (err && err.message ? err.message : String(err)));
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

async function extractUpdate(grant, sourceText) {
  const prompt = [
    'Sa kontrollid Eesti ettevotlus-/korteriuhistutoetuse andmeid ametliku allikalehe teksti pohjal.',
    '',
    'PRAEGUNE KIRJE (JSON):',
    JSON.stringify(grant, null, 2),
    '',
    'ALLIKALEHE TEKST (' + grant.source_url + '):',
    sourceText ?? '(lehte ei onnestunud laadida)',
    '',
    'ULESANNE:',
    'Tagasta AINULT JSON (sama struktuuriga nagu praegune kirje, valjad: id, name, provider, target_segment, status, round_opens, round_closes, round_notes, max_amount_eur, funding_rate, requirements, description, source_url, last_verified).',
    '',
    'REEGLID:',
    '- Kui allikatekst ei anna selget toendit muutuse kohta mone valja osas, JATA see valja TAPSELT samaks mis praeguses kirjes. Ara oleta ega genereeri infot, mida tekstis pole.',
    '- Kui lehte ei onnestunud laadida, tagasta kirje muutumatuna (v.a last_verified, mida EI TOHI sel juhul muuta).',
    '- Kui leht laadus ja said kirjet kontrollida, pane last_verified vaartuseks "' + today + '", olenemata sellest, kas midagi muutus.',
    '- id ja source_url ei tohi kunagi muutuda.',
    'Valjund peab olema valiidne JSON, ilma kommentaarideta, ilma markdown code-fence ideta.',
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error('Anthropic API viga: ' + res.status + ' ' + (await res.text()));
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Ei suutnud JSON eraldada vastusest: ' + text);
  return JSON.parse(jsonMatch[0]);
}

function deepEqualExcept(a, b, excludeKeys) {
  const ak = Object.keys(a).filter((k) => !excludeKeys.includes(k));
  const bk = Object.keys(b).filter((k) => !excludeKeys.includes(k));
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

async function main() {
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  const grants = JSON.parse(raw);

  let anyChange = false;
  let materialChange = false;
  const diffLines = [];

  const updated = [];
  for (const grant of grants) {
    console.log('--- ' + grant.id + ' ---');
    const sourceText = await fetchSourceText(grant.source_url);
    let next;
    try {
      next = await extractUpdate(grant, sourceText);
    } catch (err) {
      console.error('Viga kirje ' + grant.id + ' tootlemisel: ' + err.message);
      updated.push(grant);
      continue;
    }

    const sameContent = deepEqualExcept(grant, next, ['last_verified']);
    if (next.last_verified !== grant.last_verified) anyChange = true;
    console.log(grant.id + ': last_verified ' + grant.last_verified + ' -> ' + next.last_verified + ', sisu muutus: ' + !sameContent);

    if (!sameContent) {
      materialChange = true;
      anyChange = true;
      diffLines.push('### ' + grant.name + ' (' + grant.id + ')');
      for (const key of Object.keys(next)) {
        if (key === 'last_verified') continue;
        if (JSON.stringify(grant[key]) !== JSON.stringify(next[key])) {
          diffLines.push('- **' + key + '**: `' + JSON.stringify(grant[key]) + '` -> `' + JSON.stringify(next[key]) + '`');
        }
      }
    }
    updated.push(next);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');

  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    const prBody = materialChange
      ? 'Automaatne kontroll (' + today + ') leidis sisulisi muutusi toetuste andmetes.\n\n' + diffLines.join('\n') + '\n\nPalun vaata ule ja mergi, kui korrektne.'
      : '';
    await fs.appendFile(
      outPath,
      'any_change=' + anyChange + '\nmaterial_change=' + materialChange + '\npr_body<<EOF\n' + prBody + '\nEOF\n'
    );
  }

  console.log('any_change=' + anyChange + ' material_change=' + materialChange);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
