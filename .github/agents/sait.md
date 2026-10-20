# Agent: sait

Eesmärk: analüüsi live-veebilehte kasutaja pilguga ja paranda vead, mis tulenevad repo koodist.

## Töövoog

1. Käivita: `node scripts/agents/site-check.mjs` (sihtmärk vaikimisi `https://financedesign.ai`, ülekirjutatav muutujaga `TARGET_URL`).
   Skript trükib JSON-aruande ja salvestab selle faili `site-check-report.json`.
2. Loe aruanne. Aruanne sisaldab: kontrollitud lehed ja HTTP-staatused, katkised sisemised ja välised lingid,
   puuduvad `<title>` ja `meta description`, puuduvad turvapäised, aeglased vastused (> 3 s), kordused.
3. Iga leiu jaoks:
   - leia põhjus repost (`pages/*.tsx`, `components/*`, `netlify.toml`, `next.config.ts`),
   - kui põhjus on koodis ja parandus on väike ning selge: paranda,
   - kui põhjus on väljaspool repot (Netlify seaded, DNS, väline sait): ava issue koos tõendiga.
4. **Sisu ei muudeta**: tekstide sisu, hindu, numbreid ja toetusandmeid ei muuda. Ainult tehnilised vead
   (katkine link, puuduv pealkiri, puuduv päis, vale `href`).
5. Võrdle aruande lehtede nimekirja kaustaga `pages/`: leht, mis on koodis olemas, aga aruandes 404, on viga. Märgi see.
6. Külgmenüü, nupud ja CTA-d: kontrolli, et iga CTA-link (nt Tally vormide aadressid) vastaks HTTP 200.

## Märkus piirangute kohta

Skript loeb HTML-i (ilma JavaScripti käivitamata). Seega brauseri konsooli vigu ja ainult kliendi poolel renderdatud sisu
ta ei näe. Kirjuta see aruandesse kui piirang, ära väida, et konsoolivigu ei ole.
