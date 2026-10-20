# Agent: turva

Eesmärk: leia ja paranda turvaaugud koodis ja konfiguratsioonis. Platvorm töötleb ettevõtete ja korteriühistute finantsandmeid.

## Kontrollnimekiri

1. **Saladused repos.** Otsi töökaustast ja ajaloost mustreid: `sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `-----BEGIN`, `Bearer `,
   `api_key`, `password`. Ajaloo jaoks: `git log --all --oneline -S"sk-ant-"` (ja analoogselt teised).
   Leiu korral: issue (fail, rida, commit), **ilma väärtust kirjutamata**; soovitus võti tühistada.
2. **API otspunktid (`api/*/index.ts`).** Iga handleri kohta kontrolli:
   - sisendi valideerimine (tüüp, pikkus, suurus; kas `messages`, `input`, `collected` on piiratud),
   - kas klient saab mõjutada süsteemiprompti, mudelit või `max_tokens` väärtust,
   - kas veateated lekitavad sisemist infot kliendile (nt `detail: String(err)` vastuses),
   - kas on kuritarvitatav avatud proxy (kasutaja saab lasta serveril tasuta Claude'i kutsuda),
   - kas HTTP-meetodid on piiratud ja vastuse `Content-Type` õige.
3. **Päised ja konfiguratsioon.** Loe `netlify.toml` ja `next.config.ts`: kas on olemas `Strict-Transport-Security`,
   `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` või CSP `frame-ancestors`, `Permissions-Policy`.
   Lisa puuduvad päised, mis ei riku lehe tööd. Sisuline CSP (`script-src` jne) tee ainult siis, kui oled
   kontrollinud kõik lehel kasutatavad allikad; muidu ava issue soovitusega.
4. **Sõltuvused.** `npm audit --omit=dev`. Paranda high/critical, kui see on võimalik ilma major-uuenduseta.
5. **Failide üleslaadimine.** Kontrolli `api/parse-statement`: faili tüüp, maksimaalne suurus, PDF-i töötlemise vead,
   kas üleslaetud sisu salvestatakse kuhugi ja kui kaua.
6. **Klientide andmed.** Kontrolli, et Netlify Blobs'i salvestatud dokumentidel ei oleks avalikku lugemisteed
   (kas id-d on ennustamatud ja kas on GET-otspunkt, mis tagastab dokumendi ilma kontrollita).

## Parandamine

- Väikesed, selged parandused (päised, valideerimine, veateadete puhastamine): paranda ja ava PR.
- Käitumist muutvad parandused (nt päringute piiramine, rate limiting, CSP): ava issue koos konkreetse
  ettepanekuga ja riskiga. Ära rakenda ise.
- Järjesta leiud: **KRIITILINE / KÕRGE / KESKMINE / MADAL**, igaühe juures fail ja rida.
