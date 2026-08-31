// Netlify Function (v2, Web API handler)
// Vormistab varem genereeritud dokumendi päris .xlsx failiks, kasutades
// tegelikke Exceli valemeid (mitte staatilisi arve) — finantsprognoos ja
// rahavoo mudel. Kasutab "exceljs" npm paketti.

import ExcelJS from "exceljs";
import { getGeneratedDocument } from "../../lib/documents/store";
import { getDocumentType } from "../../lib/documents/registry";

export const config = {
  path: "/api/document-xlsx",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonResponse({ error: "Query param 'id' on kohustuslik" }, 400);
  }

  const document = await getGeneratedDocument(id);
  if (!document) {
    return jsonResponse({ error: `Dokumenti id="${id}" ei leitud` }, 404);
  }

  const config = getDocumentType(document.type_id);
  if (!config) {
    return jsonResponse({ error: `Tundmatu dokumenditüüp: ${document.type_id}` }, 500);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Finantsdisain AI";
  wb.created = new Date(document.generated_at);

  if (document.type_id === "finantsprognoos") {
    buildFinantsprognoosSheet(wb, document.input);
  } else if (document.type_id === "rahavoo-mudel") {
    buildRahavooSheet(wb, document.input);
  } else {
    // Fallback: lihtne andmete tabel, kui tüüp pole spetsiifiliselt toetatud.
    const sheet = wb.addWorksheet("Andmed");
    sheet.addRow(["Väli", "Väärtus"]);
    for (const [k, v] of Object.entries(document.input)) sheet.addRow([k, v]);
  }

  const commentSheet = wb.addWorksheet("Kommentaar");
  commentSheet.columns = [{ width: 100 }];
  for (const section of document.sections) {
    commentSheet.addRow([section.heading]).font = { bold: true };
    commentSheet.addRow([section.narrative]);
    commentSheet.addRow([]);
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${config.id}-${id}.xlsx"`,
    },
  });
}

function buildFinantsprognoosSheet(wb: ExcelJS.Workbook, input: Record<string, string | number>) {
  const sheet = wb.addWorksheet("Prognoos");
  const currentRevenue = Number(input.current_revenue ?? 0);
  const growthPct = Number(input.revenue_growth_pct ?? 0) / 100;
  const marginPct = Number(input.gross_margin_pct ?? 0) / 100;
  const fixedMonthly = Number(input.fixed_costs_monthly ?? 0);

  sheet.addRow(["", "Aasta 1", "Aasta 2", "Aasta 3"]);
  sheet.getCell("B1").font = { bold: true };
  sheet.getCell("C1").font = { bold: true };
  sheet.getCell("D1").font = { bold: true };

  sheet.addRow(["Kasvumäär", growthPct, growthPct, growthPct]);
  sheet.getCell("B2").numFmt = "0%";
  sheet.getCell("C2").numFmt = "0%";
  sheet.getCell("D2").numFmt = "0%";

  sheet.addRow(["Käive", currentRevenue, { formula: "B3*(1+B2)" }, { formula: "C3*(1+C2)" }]);
  sheet.addRow(["Brutomarginaal", marginPct, marginPct, marginPct]);
  sheet.getCell("B4").numFmt = "0%";
  sheet.getCell("C4").numFmt = "0%";
  sheet.getCell("D4").numFmt = "0%";

  sheet.addRow(["Brutokasum", { formula: "B3*B4" }, { formula: "C3*C4" }, { formula: "D3*D4" }]);
  sheet.addRow(["Püsikulud aastas", fixedMonthly * 12, fixedMonthly * 12, fixedMonthly * 12]);
  sheet.addRow(["Ärikasum (EBIT)", { formula: "B5-B6" }, { formula: "C5-C6" }, { formula: "D5-D6" }]);

  for (const row of [3, 5, 6, 7]) {
    for (const col of ["B", "C", "D"]) {
      sheet.getCell(`${col}${row}`).numFmt = "#,##0 €";
    }
  }
  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
}

function buildRahavooSheet(wb: ExcelJS.Workbook, input: Record<string, string | number>) {
  const sheet = wb.addWorksheet("Rahavoog");
  const opening = Number(input.opening_balance ?? 0);
  const inflow = Number(input.monthly_inflow ?? 0);
  const outflow = Number(input.monthly_outflow ?? 0);

  sheet.addRow(["Kuu", "Laekumine", "Väljaminek", "Saldo"]);
  sheet.getRow(1).font = { bold: true };

  for (let m = 1; m <= 12; m++) {
    const row = m + 1;
    const saldoFormula =
      m === 1 ? `${opening}+B${row}-C${row}` : `D${row - 1}+B${row}-C${row}`;
    sheet.addRow([`Kuu ${m}`, inflow, outflow, { formula: saldoFormula }]);
    sheet.getCell(`B${row}`).numFmt = "#,##0 €";
    sheet.getCell(`C${row}`).numFmt = "#,##0 €";
    sheet.getCell(`D${row}`).numFmt = "#,##0 €";
  }

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
