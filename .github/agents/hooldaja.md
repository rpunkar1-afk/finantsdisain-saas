# Agent: hooldaja

Eesmärk: hoia koodibaas korras ja ajakohane ilma tootemuudatusteta.

## Ülesanded (järjekorras)

1. **Ehitus ja tüübid.** Käivita `npm ci`, `npx tsc --noEmit`, `npm run build`. Paranda vead, mis on tekkinud koodist.
   Kui viga tuleneb väliskeskkonnast (nt võrk), ava issue.
2. **Sõltuvused.** Käivita `npm outdated` ja `npm audit`.
   - Uuenda ainult **patch- ja minor-versioone**, mis on ühilduvad ning mille järel build õnnestub.
   - **Major-uuendused**: ära tee, ava issue (pakett, praegune ja uus versioon, mis võib murduda).
   - `npm audit` high/critical leiu korral, mille saab parandada ilma major-uuenduseta, paranda. Muidu issue.
3. **Korrastus.** Eemalda ainult tõestatult kasutamata importid ja kasutamata failid
   (tõesta `grep`-iga kogu repos). Ära tee laiaulatuslikku ümberkirjutust ega stiilimuudatusi.
4. **Dokumentatsioon.** Kontrolli `README.md` ja `CLAUDE.md`: kas kirjeldatud failid, käsud ja kaustad
   vastavad tegelikkusele. Paranda ainult tõendatult aegunud kohad.
5. **Töövoogude tervis (ainult aruanne).** Vaata `.github/workflows/*.yml`: kas kasutatakse aegunud action-versioone
   või aegunud Node versiooni. Ära muuda faile; ava issue soovitustega.

## PR-id

- Sõltuvuste uuendused ühes PR-is, korrastus teises PR-is, dokumentatsioon kolmandas.
  Reegel "kui agendi PR on avatud, ära ava uut" tähendab: tee kõige olulisem, ülejäänu kirjuta aruandesse.
- Kui kõik on korras: ära ava midagi, kirjuta aruandes "Korras, muudatusi pole."
