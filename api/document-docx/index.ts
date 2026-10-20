// Netlify Function (v2, Web API handler)
// Vormistab varem genereeritud dokumendi (Claude'i narratiiv-sektsioonid) päris
// .docx failiks. Kasutab "docx" npm paketti. Vormistatud dokumendid: äriplaan,
// riskianalüüs, SWOT, KPI raport.

import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { getGeneratedDocument } from "../../lib/documents/store";
import { getDocumentType } from "../../lib/documents/registry";

export const config = {
  path: "/api/document-docx",
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

  const entityName = String(document.input.company_name ?? "");

  const children: Paragraph[] = [
    new Paragraph({
      text: config.title,
      heading: HeadingLevel.TITLE,
    }),
  ];

  if (entityName) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: entityName, italics: true })],
      }),
    );
  }

  if (document.analysis) {
    children.push(
      new Paragraph({
        text: `Skoor ${document.analysis.score}/100, riskitase: ${document.analysis.risk_level}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const b of document.analysis.breakdown) {
      children.push(
        new Paragraph({ children: [new TextRun(`${b.label}: ${b.bandLabel} (${b.points}/${b.weight} punkti)`)] }),
      );
    }
  }

  for (const section of document.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (const line of section.narrative.split("\n").filter((l) => l.trim())) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  if (document.review && document.review.status === "warning") {
    children.push(new Paragraph({ text: "Kontrolöri märkused", heading: HeadingLevel.HEADING_1 }));
    for (const i of document.review.issues) {
      const heading = document.sections.find((s) => s.id === i.section_id)?.heading ?? i.section_id;
      children.push(new Paragraph({ children: [new TextRun(`${heading}: ${i.detail}`)] }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${config.id}-${id}.docx"`,
    },
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
