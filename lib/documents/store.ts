// Väike jagatud abifunktsioon: taastab varem genereeritud dokumendi
// Netlify Blobs'ist id järgi. Kasutavad kõik kolm väljundformaadi endpointi
// (document-docx, document-xlsx, document-pdf).

import { getStore } from "@netlify/blobs";
import type { GeneratedDocument } from "./generate";

export async function getGeneratedDocument(id: string): Promise<GeneratedDocument | null> {
  const store = getStore("documents");
  const data = await store.get(id, { type: "json" });
  return (data as GeneratedDocument | null) ?? null;
}
