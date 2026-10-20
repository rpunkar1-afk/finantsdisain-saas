// Dokumendigeneraatorite register.
// Iga kirje kirjeldab ühte /tools/[type] lehel ja Peeter-vestluses genereeritavat
// dokumenditüüpi: milliseid sisendväljasid kogutakse, mitu narratiivi-sektsiooni
// dokument koosneb, ja millises formaadis (docx/xlsx/pdf) see väljastatakse.
// Formaadireegel on fikseeritud: vormistatud dokumendid (äriplaan, riskianalüüs,
// SWOT, KPI raport) -> docx; finantsmudelid (finantsprognoos, rahavoo mudel) ->
// xlsx päris valemitega; lõplik allkirjastatav pakett (investoripitch) -> pdf.

export type FieldType = "text" | "textarea" | "number" | "select";
export type OutputFormat = "docx" | "xlsx" | "pdf";

export interface SelectOption {
  value: string; // võti, mis salvestatakse (nt skoorimootori kategooria võti)
  label: string; // inimloetav sõnastus, mida kasutajale näidatakse
}

export interface DocField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  unit?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: SelectOption[]; // kohustuslik, kui type === "select"
  min?: number; // number-väljade lubatud alampiir (kaasa arvatud)
  max?: number; // number-väljade lubatud ülempiir (kaasa arvatud)
}

// Kui dokumenditüübil on "analysis", arvutab generaator enne narratiivi kirjutamist
// deterministliku analüüsi (skoor, riskitase, tugevused/nõrkused, tegevuskava)
// skoorimootori reeglitest. Väljade id-d peavad vastama skoorireeglite id-dele.
export interface DocAnalysisConfig {
  segment: "vke" | "ky";
}

export interface DocSection {
  id: string;
  heading: string;
  instruction: string; // juhis Claude'ile, mida see sektsioon peab kajastama
}

export interface DocumentTypeConfig {
  id: string;
  title: string;
  description: string;
  audience: string;
  outputFormat: OutputFormat;
  fields: DocField[];
  sections: DocSection[];
  analysis?: DocAnalysisConfig;
}

// Skoorimootori sisendväljad (VKE). Id-d vastavad lib/scoring/rules.ts reegli id-dele.
const VKE_SCORING_FIELDS: DocField[] = [
    { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
    { id: "dscr", label: "DSCR (võlateenindamise kattekordaja)", type: "number", unit: "x", required: true, min: 0, max: 50, placeholder: "nt 1.4" },
    { id: "cost_structure", label: "Püsikulude osakaal kogukuludest", type: "number", unit: "0-1", required: true, min: 0, max: 1, placeholder: "nt 0.45" },
    { id: "tax_debt", label: "Maksuvõlg", type: "number", unit: "€", required: true, min: 0 },
    {
      id: "revenue_stability",
      label: "Käibe stabiilsus",
      type: "select",
      required: true,
      options: [
        { value: "cv_low_trend_up", label: "Väga stabiilne ja kasvav (kõikumine alla 15%, trend positiivne)" },
        { value: "cv_low_trend_flat", label: "Stabiilne, kuid ei kasva (kõikumine alla 15%), või mõõdukalt kõikuv (15-30%) ja kasvav" },
        { value: "cv_mid_trend_flat", label: "Mõõdukalt kõikuv (15-30%) ja ei kasva, või väga kõikuv (üle 30%) ja kasvav" },
        { value: "cv_high_trend_down", label: "Väga kõikuv (üle 30%) ja langev" },
      ],
    },
    {
      id: "company_age",
      label: "Ettevõtte vanus",
      type: "select",
      required: true,
      options: [
        { value: "3y_plus", label: "3 aastat või rohkem" },
        { value: "1y_3y", label: "1-3 aastat" },
        { value: "6m_12m", label: "6-12 kuud" },
        { value: "0m_6m", label: "0-6 kuud" },
      ],
    },
    {
      id: "accounting_quality",
      label: "Raamatupidamise kvaliteet",
      type: "select",
      required: true,
      options: [
        { value: "consistent_no_arrears", label: "Järjepidev, viivisteta" },
        { value: "consistent_minor_arrears", label: "Järjepidev, väiksed viivised" },
        { value: "inconsistent_no_arrears", label: "Ebajärjepidev, viivisteta" },
        { value: "inconsistent_with_arrears", label: "Ebajärjepidev, viivistega" },
      ],
    },
  ]

// KÜ valmiduse sisendväljad. Esimesed kolm vastavad KÜ skooriregli id-dele (lib/scoring/rules.ts),
// ülejäänud kaks lib/ky/readiness.ts kontrollnimekirjale.
const KY_FIELDS: DocField[] = [
  { id: "company_name", label: "Korteriühistu nimi", type: "text", required: true },
  { id: "ky_debt_ratio", label: "Liikmete võlgnevused osakaaluna majanduskuludest", type: "number", unit: "0-1", required: true, min: 0, max: 1, placeholder: "nt 0.04" },
  { id: "maintenance_fund_coverage", label: "Hooldusfondi kate", type: "number", unit: "€/m²", required: true, min: 0, placeholder: "nt 0.8" },
  {
    id: "general_meeting_decision",
    label: "Üldkoosoleku otsus laenu/investeeringu kohta",
    type: "select",
    required: true,
    options: [
      { value: "two_thirds_majority", label: "2/3 häälteenamus" },
      { value: "simple_majority", label: "50% (lihthäälteenamus)" },
      { value: "missing", label: "Otsus puudub" },
    ],
  },
  {
    id: "energy_label",
    label: "Energiamärgis",
    type: "select",
    required: true,
    options: [
      ...["A", "B", "C", "D", "E", "F", "G"].map((l) => ({ value: l, label: `Energiamärgis ${l}` })),
      { value: "none", label: "Energiamärgis puudub" },
    ],
  },
  {
    id: "technical_consultant",
    label: "Tehniline konsultant",
    type: "select",
    required: true,
    options: [
      { value: "engaged", label: "Kaasatud" },
      { value: "not_engaged", label: "Pole kaasatud" },
    ],
  },
]

export const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: "ariplaan",
    title: "Äriplaan",
    description: "Pangale või investorile: kokkuvõte, äriidee ja turg, meeskond, rahastusvajadus.",
    audience: "VKE",
    outputFormat: "docx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "business_idea", label: "Äriidee kirjeldus", type: "textarea", required: true },
      { id: "target_market", label: "Sihtturg", type: "textarea", required: true },
      { id: "team", label: "Meeskond ja kogemus", type: "textarea", required: true },
      { id: "funding_need", label: "Rahastusvajadus", type: "number", unit: "€", required: true },
      { id: "use_of_funds", label: "Raha kasutuse plaan", type: "textarea", required: true },
    ],
    sections: [
      { id: "summary", heading: "Kokkuvõte", instruction: "Kokkuvõte ettevõttest, äriideest ja rahastusvajadusest kolmes-neljas lauses." },
      { id: "market", heading: "Äriidee ja turg", instruction: "Kirjelda äriideed ja sihtturgu antud sisendi põhjal, too välja konkurentsieelis, kui see andmetest nähtub." },
      { id: "team", heading: "Meeskond", instruction: "Kirjelda meeskonna kogemust ja suutlikkust äriideed ellu viia." },
      { id: "funding", heading: "Rahastusvajadus ja kasutus", instruction: "Selgita rahastusvajaduse suurust ja kuidas raha kasutatakse, lähtudes antud plaanist." },
    ],
  },
  {
    id: "finantsprognoos",
    title: "Finantsprognoos",
    description: "3 aasta käibe- ja kasumiprognoos Excelis päris valemitega.",
    audience: "VKE",
    outputFormat: "xlsx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "current_revenue", label: "Praegune aastakäive", type: "number", unit: "€", required: true },
      { id: "revenue_growth_pct", label: "Eeldatav aastane käibekasv", type: "number", unit: "%", required: true },
      { id: "gross_margin_pct", label: "Brutomarginaal", type: "number", unit: "%", required: true },
      { id: "fixed_costs_monthly", label: "Püsikulud kuus", type: "number", unit: "€", required: true },
    ],
    sections: [
      { id: "assumptions", heading: "Eeldused", instruction: "Selgita prognoosi aluseks olevaid eeldusi (käibekasv, marginaal, püsikulud) lähtudes antud sisendist." },
      { id: "summary", heading: "3 aasta kokkuvõte", instruction: "Kommenteeri 3-aastast käibe- ja kasumitrendi, mis tuleneb eeldustest — kas trend on tervislik ja millele tähelepanu pöörata." },
    ],
  },
  {
    id: "riskianaluus",
    title: "Riskianalüüs",
    description: "Riskid, mõju, tõenäosus ja leevendusmeetmed.",
    audience: "VKE",
    outputFormat: "docx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "business_description", label: "Äritegevuse kirjeldus", type: "textarea", required: true },
      { id: "known_risks", label: "Teadaolevad riskid", type: "textarea", required: true },
    ],
    sections: [
      { id: "mapping", heading: "Riskide kaardistus", instruction: "Kaardista antud äritegevuse ja teadaolevate riskide põhjal peamised riskikategooriad (turg, finants, operatsioon, õigus)." },
      { id: "impact", heading: "Mõju ja tõenäosus", instruction: "Hinda iga tuvastatud riski mõju ja tõenäosust lähtudes antud kirjeldusest." },
      { id: "mitigation", heading: "Leevendusmeetmed", instruction: "Paku konkreetsed leevendusmeetmed iga peamise riski kohta." },
    ],
  },
  {
    id: "kpi-raport",
    title: "KPI raport",
    description: "Juhtimisarvestuse ülevaade kuu või kvartali kohta.",
    audience: "VKE",
    outputFormat: "docx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "period", label: "Periood", type: "text", placeholder: "nt 2026 Q3", required: true },
      { id: "revenue", label: "Käive", type: "number", unit: "€", required: true },
      { id: "ebitda", label: "EBITDA", type: "number", unit: "€", required: true },
      { id: "headcount", label: "Töötajate arv", type: "number", required: true },
      { id: "key_notes", label: "Olulised sündmused perioodil", type: "textarea", required: false },
    ],
    sections: [
      { id: "summary", heading: "Perioodi kokkuvõte", instruction: "Kokkuvõte perioodi tulemustest antud numbrite põhjal." },
      { id: "kpi", heading: "KPI analüüs", instruction: "Analüüsi käibe, EBITDA ja töötajate arvu suhet — kas näitajad on tasakaalus." },
      { id: "notes", heading: "Tähelepanekud", instruction: "Kommenteeri perioodi olulisi sündmusi, kui need on antud." },
    ],
  },
  {
    id: "swot",
    title: "SWOT",
    description: "Tugevused, nõrkused, võimalused, ohud.",
    audience: "VKE",
    outputFormat: "docx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "strengths", label: "Tugevused", type: "textarea", required: true },
      { id: "weaknesses", label: "Nõrkused", type: "textarea", required: true },
      { id: "opportunities", label: "Võimalused", type: "textarea", required: true },
      { id: "threats", label: "Ohud", type: "textarea", required: true },
    ],
    sections: [
      { id: "strengths", heading: "Tugevused", instruction: "Vormista antud tugevused struktureeritud analüüsiks." },
      { id: "weaknesses", heading: "Nõrkused", instruction: "Vormista antud nõrkused struktureeritud analüüsiks." },
      { id: "opportunities", heading: "Võimalused", instruction: "Vormista antud võimalused struktureeritud analüüsiks." },
      { id: "threats", heading: "Ohud", instruction: "Vormista antud ohud struktureeritud analüüsiks." },
    ],
  },
  {
    id: "investoripitch",
    title: "Investoripitch",
    description: "Struktureeritud investorpakkumine koos numbrite ja rahastusküsimusega.",
    audience: "VKE",
    outputFormat: "pdf",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "problem", label: "Probleem", type: "textarea", required: true },
      { id: "solution", label: "Lahendus", type: "textarea", required: true },
      { id: "market_size", label: "Turu suurus", type: "textarea", required: true },
      { id: "business_model", label: "Ärimudel", type: "textarea", required: true },
      { id: "traction", label: "Senine traktsioon", type: "textarea", required: false },
      { id: "funding_ask", label: "Küsitav investeering", type: "number", unit: "€", required: true },
    ],
    sections: [
      { id: "problem_solution", heading: "Probleem ja lahendus", instruction: "Vormista probleem ja lahendus selgeks investorile suunatud narratiiviks." },
      { id: "market_model", heading: "Turg ja ärimudel", instruction: "Selgita turu suurust ja ärimudelit antud sisendi põhjal." },
      { id: "traction", heading: "Traktsioon", instruction: "Kirjelda senist traktsiooni, kui see on antud; kui pole, ütle selgelt, et ettevõte on varajases faasis." },
      { id: "ask", heading: "Investeeringu küsimus", instruction: "Selgita küsitava investeeringu suurust ja mida see võimaldab saavutada." },
    ],
  },
  {
    id: "finantsvalmiduse-hinnang",
    title: "Finantsvalmiduse hinnang",
    description: "Laenuvalmiduse skoor (0-100), riskitase, tugevused, nõrkused ja tegevuskava reeglipõhise analüüsi alusel.",
    audience: "VKE",
    outputFormat: "docx",
    analysis: { segment: "vke" },
    fields: VKE_SCORING_FIELDS,
    sections: [
      { id: "summary", heading: "Kokkuvõte", instruction: "Kokkuvõte koondskoorist ja riskitasemest. Kasuta täpselt analysis.score ja analysis.risk_level väärtusi; ära arvuta skoori ise." },
      { id: "criteria", heading: "Skoor kriteeriumite lõikes", instruction: "Selgita, kuidas koondskoor kriteeriumite lõikes tekkis, lähtudes analysis.breakdown andmetest (punktid ja kaal iga kriteeriumi kohta)." },
      { id: "strengths", heading: "Tugevused", instruction: "Too välja tugevused analysis.strengths põhjal. Kui tugevusi pole, ütle seda otse." },
      { id: "weaknesses", heading: "Nõrkused ja riskid", instruction: "Too välja nõrkused ja riskid analysis.weaknesses põhjal. Kui nõrkusi pole, ütle seda otse." },
      { id: "actions", heading: "Tegevuskava", instruction: "Kokkuvõta tegevused analysis.action_plan põhjal prioriteedi järgi (high enne medium). Ära lisa tegevusi, mida plaanis pole." },
    ],
  },
  {
    id: "tegevuskava",
    title: "90 päeva tegevuskava",
    description: "Laenuvalmiduse tõstmise plaan 90 päevaks: olukorra analüüs, sammud etappide kaupa, riskid ja esimesed sammud.",
    audience: "VKE",
    outputFormat: "docx",
    analysis: { segment: "vke" },
    fields: [
      ...VKE_SCORING_FIELDS,
      { id: "goal", label: "Eesmärk (mida laen või rahastus peab võimaldama)", type: "textarea", required: false },
    ],
    sections: [
      { id: "summary", heading: "Kokkuvõte", instruction: "Kokkuvõte olukorrast (analysis.score, analysis.risk_level) ja plaani eesmärgist. Kui sisendis on 'goal', nimeta see; kui puudub, ära oleta eesmärki." },
      { id: "analysis", heading: "Olukorra analüüs", instruction: "Selgita, mis skoori kõige enam tõmbab, lähtudes analysis.weaknesses ja analysis.breakdown andmetest." },
      { id: "phase1", heading: "Päevad 1-30", instruction: "Kirjelda analysis.plan_90d etapi '1-30' tegevused (prioriteet kõrge). Iga tegevuse juures: mida teha ja millisele kriteeriumile see viitab. Ära lisa tegevusi, mida plaanis pole. Kui tegevusi pole, ütle seda." },
      { id: "phase2", heading: "Päevad 31-60", instruction: "Kirjelda analysis.plan_90d etapi '31-60' tegevused. Ära lisa tegevusi, mida plaanis pole. Kui tegevusi pole, ütle seda." },
      { id: "phase3", heading: "Päevad 61-90", instruction: "Kirjelda analysis.plan_90d etapi '61-90' kontrollpunkt täpselt nii nagu antud." },
      { id: "risks", heading: "Riskid", instruction: "Too välja riskid, mis plaani täitmist ohustavad, lähtudes ainult analysis.weaknesses ja analysis.risk_level andmetest." },
      { id: "next", heading: "Järgmised sammud", instruction: "Nimeta 1-3 esimest sammu, mida teha järgmise 7 päeva jooksul, valides need analysis.plan_90d esimese etapi tegevuste hulgast. Kui seal tegevusi pole, ütle seda." },
    ],
  },
  {
    id: "ky-valmidus",
    title: "Korteriühistu laenuvalmiduse hinnang",
    description: "KÜ skoor (0-100), riskitase, valmiduse kontrollnimekiri ja sammud EIS taotluseni.",
    audience: "KÜ",
    outputFormat: "docx",
    analysis: { segment: "ky" },
    fields: KY_FIELDS,
    sections: [
      { id: "summary", heading: "Kokkuvõte", instruction: "Kokkuvõte KÜ koondskoorist ja riskitasemest (analysis.score, analysis.risk_level) ning sellest, kas ühistu on taotluseks valmis (analysis.ky_readiness.overall_ready). Ära arvuta skoori ise." },
      { id: "criteria", heading: "Skoor kriteeriumite lõikes", instruction: "Selgita, kuidas skoor kriteeriumite lõikes tekkis, lähtudes analysis.breakdown andmetest (punktid ja kaal)." },
      { id: "checklist", heading: "Valmiduse kontrollnimekiri", instruction: "Kirjelda iga analysis.ky_readiness.checklist kirje staatus (ok / warning / blocked) ja detail täpselt nii nagu antud. Ära lisa kirjeid, mida nimekirjas pole." },
      { id: "steps", heading: "Sammud EIS taotluseni", instruction: "Esita analysis.ky_readiness.next_steps sammud samas järjekorras, ilma samme lisamata või välja jätmata." },
    ],
  },
  {
    id: "rahavoo-mudel",
    title: "Rahavoo mudel",
    description: "12 kuu likviidsusvaade Excelis päris valemitega.",
    audience: "VKE",
    outputFormat: "xlsx",
    fields: [
      { id: "company_name", label: "Ettevõtte nimi", type: "text", required: true },
      { id: "opening_balance", label: "Algsaldo", type: "number", unit: "€", required: true },
      { id: "monthly_inflow", label: "Eeldatav laekumine kuus", type: "number", unit: "€", required: true },
      { id: "monthly_outflow", label: "Eeldatav väljaminek kuus", type: "number", unit: "€", required: true },
    ],
    sections: [
      { id: "assumptions", heading: "Eeldused", instruction: "Selgita rahavoo mudeli aluseks olevaid eeldusi antud sisendi põhjal." },
      { id: "outlook", heading: "12 kuu väljavaade", instruction: "Kommenteeri, kas 12 kuu jooksul jääb saldo positiivseks ja millal tekiks likviidsusrisk, kui väljaminekud ületavad laekumisi." },
    ],
  },
];

export function getDocumentType(id: string): DocumentTypeConfig | undefined {
  return DOCUMENT_TYPES.find((t) => t.id === id);
}
