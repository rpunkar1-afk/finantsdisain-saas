// Samm 3: Normaliseerija
// Teisendab Sammu 2 (parse-statement) väljundi ühtsele struktuurile,
// lisades kategooria ja merchant-tuvastuse.

export type TransactionCategory =
  | "income"
  | "fixed_costs"
  | "variable_costs"
  | "taxes"
  | "risk_costs"
  | "transfers"
  | "other";

export interface RawParsedTransaction {
  date: string;
  amount: number;
  description: string;
  balance: number | null;
}

export interface RawParseResult {
  bank: "nordea" | "swedbank" | "seb" | "unknown";
  account_number: string | null;
  currency: string;
  transactions: RawParsedTransaction[];
}

export interface NormalizedTransaction {
  date: string;
  amount: number;
  description: string;
  merchant: string;
  category: TransactionCategory;
  account: string | null;
  balance: number | null;
}

export interface NormalizedStatement {
  account: string | null;
  currency: string;
  bank: string;
  transactions: NormalizedTransaction[];
}

// Kategoriseerimisreeglid: võtmesõna -> kategooria (Eesti panganduskontekst)
// Deterministlik, järjekord määrab prioriteedi (esimene sobiv reegel võidab).
const CATEGORY_RULES: Array<{ pattern: RegExp; category: TransactionCategory }> = [
  // Maksud
  { pattern: /\bemta\b|maksu[-\s]?amet|maksuvõlg|käibemaks|\bkmkr\b|tulumaks|sotsiaalmaks/i, category: "taxes" },

  // Riskikulud (viivised, inkasso, trahvid, hasartmäng)
  { pattern: /viivis|inkasso|võlgnevus|trahv|hasartmän|kasiino|casino|laenu[-\s]?vahendus|kiirlaen/i, category: "risk_costs" },

  // Sissetulek
  { pattern: /palk|palgalaekumine|töötasu|dividend|honorar|müügitulu|arve\s*nr.*laeku|ettemaks.*klient/i, category: "income" },

  // Ülekanded (sisemised, sularaha)
  { pattern: /sularaha väljamakse|atm|omavaheline ülekanne|oma kontode vahel|säästukonto/i, category: "transfers" },

  // Püsikulud (üür, laenumaksed, kindlustus, kommunaalid, tellimused)
  {
    pattern:
      /(?<![\p{L}])üür(?![\p{L}])|rent\b|laenumakse|liisingumakse|kindlustus|elekter|küte|(?<![\p{L}])vesi(?![\p{L}])|kommunaal|internet|telefon(?:i)?\s*arve|kü\s*makse|korteriühistu|hoolduskulu|tellimus|subscription|abonement/iu,
    category: "fixed_costs",
  },

  // Muutuvkulud (jooksvad, tarbimine)
  {
    pattern:
      /toidupood|market|rimi|selver|maxima|coop|prisma|kaubamaja|restoran|kohvik|kütus|tankla|bensiin|transport|takso|bolt|uber/i,
    category: "variable_costs",
  },
];

function classify(description: string): TransactionCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) {
      return rule.category;
    }
  }
  return "other";
}

// Merchant-tuvastus: eemaldab tehingukoodid, viitenumbrid, kuupäevad kirjeldusest
function extractMerchant(description: string): string {
  let cleaned = description
    .replace(/\bviide[:\s]*\d+/gi, "")
    .replace(/\bmakse\s*id[:\s]*\S+/gi, "")
    .replace(/\d{2}\.\d{2}\.\d{4}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Kui kirjeldus sisaldab eraldajat (nt "MAKSE - RIMI OÜ - Tallinn"), võta kõige informatiivsem osa
  const parts = cleaned.split(/[-–|,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    // Eelista pikimat osa, mis pole ainult numbrid
    const candidate = parts
      .filter((p) => !/^\d+$/.test(p))
      .sort((a, b) => b.length - a.length)[0];
    cleaned = candidate || cleaned;
  }

  return cleaned || description;
}

export function normalizeStatement(raw: RawParseResult): NormalizedStatement {
  const transactions: NormalizedTransaction[] = raw.transactions.map((tx) => ({
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
    merchant: extractMerchant(tx.description),
    category: classify(tx.description),
    account: raw.account_number,
    balance: tx.balance,
  }));

  return {
    account: raw.account_number,
    currency: raw.currency,
    bank: raw.bank,
    transactions,
  };
}
