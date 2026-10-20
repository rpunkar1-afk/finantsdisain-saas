// Dokumendi sisendi valideerimine registri väljade vastu.
// Kasutavad generate-document endpoint ja Peetri vestlus (select-väljade kontroll).

import type { DocField, DocumentTypeConfig } from "./registry";

export function validateFieldValue(field: DocField, value: unknown): string | null {
  if (field.type === "number") {
    const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    if (!Number.isFinite(n)) return `${field.label}: oodati numbrit`;
    if (field.min !== undefined && n < field.min) return `${field.label}: väärtus ${n} on alla lubatud piiri ${field.min}`;
    if (field.max !== undefined && n > field.max) return `${field.label}: väärtus ${n} on üle lubatud piiri ${field.max}`;
    return null;
  }
  if (field.type === "select") {
    const allowed = (field.options ?? []).map((o) => o.value);
    if (typeof value !== "string" || !allowed.includes(value)) {
      return `${field.label}: lubatud väärtused on ${allowed.join(", ")}`;
    }
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") return `${field.label}: oodati teksti`;
  return null;
}

export function validateDocumentInput(config: DocumentTypeConfig, input: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of config.fields) {
    const value = input[field.id];
    const empty = value === undefined || value === null || value === "";
    if (empty) {
      if (field.required) errors.push(`${field.label}: puudub`);
      continue;
    }
    const err = validateFieldValue(field, value);
    if (err) errors.push(err);
  }
  return errors;
}
