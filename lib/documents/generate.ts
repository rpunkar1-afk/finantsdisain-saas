// Dokumendigeneraatori tuumaloogika.
// Sama muster mis lib/reporting: iga sektsioon genereeritakse eraldi Claude
// API kutsega, lähtudes ainult kasutaja antud sisendist. Ei leiuta fakte ega
// numbreid, mida sisendis pole.

import Anthropic from "@anthropic-ai/sdk";
import { getDocumentType, type DocumentTypeConfig } from "./registry";

export interface GeneratedSection {
  id: string;
  heading: string;
  narrative: string;
}

export interface GeneratedDocument {
  document_id: string;
  type_id: string;
  generated_at: string; // ISO 8601
  input: Record<string, string | number>;
  sections: GeneratedSection[];
}

const DOCUMENT_SYSTEM_PROMPT = `Sa oled P.E.E.T.E.R. — Finantsdisain AI finants- ja äristrateegia analüütik.
Sinu ülesanne on kirjutada üks dokumendi sektsioon, lähtudes sulle antud struktureeritud andmetest.

Reeglid:
- Kirjuta eesti keeles, professionaalses, otsekoheses toonis. Ei liigset entusiasmi, ei ebamäärasust.
- Kasuta AINULT sulle antud andmeid. Ära leiuta fakte, numbreid ega soovitusi, mida andmetes pole.
- Kui mõni vajalik andmepunkt on puudu, ütle seda otse ("andmed puuduvad"), ära oleta.
- Pikkus: 3-6 lauset, v.a kui juhend ütleb teisiti.
- Ära korda pealkirja tekstis.
- Vasta AINULT sektsiooni tekstiga, ilma preambulita, ilma markdown-pealkirjadeta.`;

async function generateSectionText(
  anthropic: Anthropic,
  heading: string,
  instruction: string,
  input: Record<string, string | number>,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: DOCUMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Sektsioon: ${heading}\n\nJuhend: ${instruction}\n\nAndmed:\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Claude API ei tagastanud teksti sektsiooni "${heading}" jaoks`);
  }
  return textBlock.text.trim();
}

export async function generateDocument(
  typeId: string,
  input: Record<string, string | number>,
  apiKey: string,
  documentId: string,
  client?: Anthropic,
): Promise<GeneratedDocument> {
  const config: DocumentTypeConfig | undefined = getDocumentType(typeId);
  if (!config) {
    throw new Error(`Tundmatu dokumenditüüp: ${typeId}`);
  }

  const anthropic = client ?? new Anthropic({ apiKey });

  const sections: GeneratedSection[] = await Promise.all(
    config.sections.map(async (s) => ({
      id: s.id,
      heading: s.heading,
      narrative: await generateSectionText(anthropic, s.heading, s.instruction, input),
    })),
  );

  return {
    document_id: documentId,
    type_id: typeId,
    generated_at: new Date().toISOString(),
    input,
    sections,
  };
}
