// Netlify Function (v2, Web API handler)
// Vormistab varem genereeritud dokumendi päris .pdf failiks. Kasutab
// "pdf-lib" npm paketti (juba projektis pangaväljavõtte töötlemiseks kasutusel
// olevate sõltuvuste kõrval). Investoripitch: üks lehekülg pealkirja kohta.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getGeneratedDocument } from "../../lib/documents/store";
import { getDocumentType } from "../../lib/documents/registry";

export const config = {
  path: "/api/document-pdf",
};

const PAGE_WIDTH = 595; // A4 pt
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const BODY_SIZE = 11;
const LINE_HEIGHT = 16;

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

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Tiitelleht
  const titlePage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  titlePage.drawText(String(document.input.company_name ?? config.title), {
    x: MARGIN,
    y: PAGE_HEIGHT - 200,
    size: 28,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  titlePage.drawText(config.title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 230,
    size: 14,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  if (document.input.funding_ask) {
    titlePage.drawText(`Küsitav investeering: ${document.input.funding_ask} €`, {
      x: MARGIN,
      y: PAGE_HEIGHT - 260,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  for (const section of document.sections) {
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    page.drawText(section.heading, {
      x: MARGIN,
      y: cursorY,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursorY -= 32;

    const wrapped = wrapText(section.narrative, font, BODY_SIZE, PAGE_WIDTH - MARGIN * 2);
    for (const line of wrapped) {
      if (cursorY < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y: cursorY,
        size: BODY_SIZE,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      cursorY -= LINE_HEIGHT;
    }
  }

  const bytes = await pdfDoc.save();

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${config.id}-${id}.pdf"`,
    },
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
