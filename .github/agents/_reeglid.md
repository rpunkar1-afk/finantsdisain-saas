# Agentide ühised reeglid (kehtivad igale agendile)

Need reeglid on kõrgemal kui agendi enda juhis. Kui juhis läheb reeglitega vastuollu, järgi reegleid.

## Töövoog

1. Loe see fail ja oma agendi juhis (`.github/agents/<nimi>.md`).
2. Kontrolli, kas sinu agendil on juba avatud PR: `gh pr list --label agent-<nimi> --state open`.
   Kui on, ära ava uut. Uuenda olemasolevat PR-i või lõpeta ja kirjuta sellest aruandes.
3. Tee töö haru peal nimega `agent/<nimi>/<AAAA-KK-PP>`. Kunagi ei tohi pushida `main`-i.
4. Enne PR-i avamist peab `npm ci && npm run build` õnnestuma. Kui ei õnnestu ja sa ei oska parandada,
   ära ava PR-i; ava issue (`gh issue create`) koos veateatega.
5. Ava PR käsuga `gh pr create --label agent --label agent-<nimi>`.
   Üks PR = üks teema. Ära koonda ebaseotud muudatusi.
6. PR-i kirjeldus on eesti keeles, lihtsas keeles, sellises järjekorras:
   - **Mis oli viga või puudus** (1-2 lauset, koos faili nime ja reaga)
   - **Mida muutsin** (loend)
   - **Kuidas kontrollisin** (nt "build õnnestus", "npm audit: 0 high")
   - **Risk** (madal / keskmine / kõrge ja miks)
7. Kui sa ei ole kindel, kas muudatus on õige, ava issue, mitte PR.

## Keelud

- Ära kunagi loe, prindi, logi ega kommiti saladusi (API-võtmed, tokenid, `.env` sisu, Netlify keskkonnamuutujate väärtused).
  Kui leiad repost saladuse, ava issue, mis ütleb ainult faili ja rea ning et võti tuleb tühistada. Ära kirjuta võtit ise issue sisse.
- Ära muuda faile `api/grants/data.json` ega `api/grants/data.discovered.json` (neid haldab toetuste torujuhe).
- Ära muuda tootefunktsioone, hindu, numbreid, õigusallikaid ega toetuste andmeid.
- Ära lisa uusi funktsioone ega uusi sõltuvusi, kui juhis seda otse ei nõua.
- Ära muuda Peetri isiksust (`lib/peeter/prompt.ts`), välja arvatud agent `peeter`, ja ka tema ainult PR-i kaudu.
- Ära kustuta faile, mis ei ole selgelt kasutamata. Kasutamata fail tõendatakse otsinguga (`grep`) kogu repos.
- Ära muuda `.github/workflows/` ega `.github/agents/` faile (agent ei muuda enda reegleid ega töövooge). Soovituse korral ava issue.
- Ära kasuta `git push --force`.

## Piirangud

- Max 15 faili ühes PR-is.
- Kui töö jääb pooleli, kirjuta lõppu lühike aruanne: mida tegid, mida ei jõudnud, miks.
- Ära oleta. Kui andmed puuduvad, kirjuta aruandes "Andmed puuduvad." ja ava issue, mis ütleb, mida on vaja.

## Aruanne töö lõpus

Lõpeta alati lühikese aruandega (kuni 10 rida): leitud asjad, tehtud PR-id (lingid), avatud issue'd, mida jäi tegemata.
