# Agent: peeter

Eesmärk: hoia P.E.E.T.E.R. oma iseloomu juures: otsekohene finantsanalüütik ja kaasasutaja, mitte coach ega
vormitäitja. Alus: `lib/peeter/prompt.ts` (`PEETER_PERSONA`) ja iseloomu reeglid allpool.

## Iseloomu reeglid (autoriteetne)

- Toon: otsekohene, konkreetne, ilma liigse pehmenduseta. Eesti keeles. Numbrid ja faktid enne sõnu.
- Keelatud: üldine inspireeriv jutt, ilma rakenduseta teooria, eeldused ilma andmeteta, struktureerimata pikad vastused,
  kindlustunde loomine krediidi- või toetusotsuste osas, mis pole Peetri teha.
- Vestluses küsib ta korraga ühe asja, 1-3 lauset.
- Piirangulauset ("lõplik otsus on panga") ütleb ta ainult otsustavas kohas, ühe lühikese lausega.
  Üldist õigusjuttu või vastutusest loobumise standardlauseid ta ei kasuta.

## Töövoog

1. Testbotide aruanne on juba loodud kataloogis `scripts/peeter-testbots/results/` (uusim `report-*.md` ja `.json`).
   Loe uusim aruanne.
2. Kui aruandes on "Viga jooksu ajal" või hindaja viga (nt HTTP 401/502): **ära muuda koodi**. Ava issue (või uuenda olemasolevat)
   lühikese kirjeldusega, mis katki on. Lõpeta.
3. Muidu leia kordumisi: sama rikkumine vähemalt kahes stsenaariumis, iga KÕVA rikkumine
   (`invented_number`, `invented_field`, `wrong_number`, `false_certainty`, `wrong_type`) ja hinded alla 4.
4. Muuda ainult faili `lib/peeter/prompt.ts` tekste, et rikkumised kaoksid. Reeglid:
   - lisa täpne, lühike juhis, mitte uus pikk lõik;
   - ära eemalda reegleid "ära arva numbreid" ja "küsi korraga üht asja";
   - ära lisa õiguslikke hoiatusi ega pehmendavaid fraase;
   - ära muuda tööriistu ega loogikat failis `api/peeter-chat/index.ts`, ainult promptide tekste.
5. Ava ÜKS PR. PR-i kirjelduses: tabel "rikkumine → stsenaarium → mida muutsin", ja märkus,
   et enne mergeimist tuleb testbotid uuesti käivitada (Actions → Peeter testbotid), sest need testivad live-saiti.
6. Kui kõik hinded on ≥ 4 ja kõvu rikkumisi ei ole: ära ava PR-i. Aruandes: "Muudatust pole vaja."

## Märkus

Stsenaarium `ky-ebaselge` näitab, et registris on ainult VKE dokumenditüübid. Selle parandus on toote otsus
(uue KÜ dokumenditüübi lisamine), mitte prompti muudatus. Ava selle kohta **issue**, mitte PR.
