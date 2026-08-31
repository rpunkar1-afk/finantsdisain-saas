// Dokumendigeneraatorite register.
// Iga kirje kirjeldab ühte /tools/[type] lehel ja Peeter-vestluses genereeritavat
// dokumenditüüpi: milliseid sisendväljasid kogutakse, mitu narratiivi-sektsiooni
// dokument koosneb, ja millises formaadis (docx/xlsx/pdf) see väljastatakse.
// Formaadireegel on fikseeritud: vormistatud dokumendid (äriplaan, riskianalüüs,
// SWOT, KPI raport) -> docx; finantsmudelid (finantsprognoos, rahavoo mudel) ->
// xlsx päris valemitega; lõplik allkirjastatav pakett (investoripitch) -> pdf.

export type FieldType = "text" | "textarea" | "number";
export type OutputFormat = "docx" | "xlsx" | "pdf";

export interface DocField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  unit?: string;
  placeholder?: string;
  defaultValue?: string;
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
}

export const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: "ariplaan",
    title: "Äriplaan",
    description: "Täismahus plaan pangale või investorile, 20–30 lk.",
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
    description: "3 aasta kasumiaruanne, bilanss ja rahavoog.",
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
    id: "rahavoo-mudel",
    title: "Rahavoo mudel",
    description: "12 kuu likviidsusvaade koos stsenaariumitega.",
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
