// Samm 6: VKE tegevuskava generaator
// Sisend: Sammu 5 (score) VKE ScoringResult
// Väljund: deterministlik, breakdown-põhine tegevuskava viies kategoorias:
// omakapitali tõstmine, kulude optimeerimine, DSCR parandamine,
// kontoväljavõtte mustrite puhastamine, maksuvõlgade likvideerimine

import type { ScoringResult, RuleBreakdown, RiskLevel } from "../scoring";

export type ActionCategory =
  | "equity_increase"
  | "cost_optimization"
  | "dscr_improvement"
  | "statement_cleanup"
  | "tax_debt_elimination";

export type ActionPriority = "high" | "medium";

export interface ActionItem {
  category: ActionCategory;
  priority: ActionPriority;
  title: string;
  description: string;
  related_criterion: string;
}

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  equity_increase: "Omakapitali tõstmine",
  cost_optimization: "Kulude optimeerimine",
  dscr_improvement: "DSCR parandamine",
  statement_cleanup: "Kontoväljavõtte mustrite puhastamine",
  tax_debt_elimination: "Maksuvõlgade likvideerimine",
};

function priorityFor(points: number, weight: number): ActionPriority {
  return points === 0 ? "high" : "medium";
}

function findRule(breakdown: RuleBreakdown[], id: string): RuleBreakdown | undefined {
  return breakdown.find((b) => b.id === id);
}

export function generateVKEActionPlan(scoringResult: ScoringResult): ActionItem[] {
  const { breakdown, risk_level } = scoringResult;
  const items: ActionItem[] = [];

  // 1. DSCR parandamine
  const dscr = findRule(breakdown, "dscr");
  if (dscr && dscr.points < dscr.weight) {
    items.push({
      category: "dscr_improvement",
      priority: priorityFor(dscr.points, dscr.weight),
      title: CATEGORY_LABELS.dscr_improvement,
      description:
        dscr.points === 0
          ? "DSCR on alla 1.2 — kriitiline tase. Suurendage rahavoogu (lisamüük, hinnatõus) või vähendage lühiajalisi kohustusi enne laenutaotlust."
          : `Praegune DSCR band: "${dscr.bandLabel}". Suurendage rahavoogu või vähendage lühiajalisi kohustusi, et jõuda järgmisse läveni (1.4 või 1.6).`,
      related_criterion: dscr.label,
    });
  }

  // 2. Kulude optimeerimine
  const costStructure = findRule(breakdown, "cost_structure");
  if (costStructure && costStructure.points < costStructure.weight) {
    items.push({
      category: "cost_optimization",
      priority: priorityFor(costStructure.points, costStructure.weight),
      title: CATEGORY_LABELS.cost_optimization,
      description:
        costStructure.points === 0
          ? "Püsikulude osakaal on üle 80% kogukuludest — struktuurne risk. Analüüsige suurimaid püsikulukirjeid (üür, tarkvaralitsentsid, personal) ja kaaluge lepingute renegotsimist."
          : `Praegune kulustruktuur: "${costStructure.bandLabel}". Vähendage püsikulude osakaalu, et jõuda järgmisse läveni.`,
      related_criterion: costStructure.label,
    });
  }

  // 3. Maksuvõlgade likvideerimine
  const taxDebt = findRule(breakdown, "tax_debt");
  if (taxDebt && taxDebt.points < taxDebt.weight) {
    items.push({
      category: "tax_debt_elimination",
      priority: priorityFor(taxDebt.points, taxDebt.weight),
      title: CATEGORY_LABELS.tax_debt_elimination,
      description:
        taxDebt.points === 0
          ? "Maksuvõlg on 1000 EUR või rohkem. Koostage EMTA-ga maksegraafik ja likvideerige võlg täielikult enne taotluse esitamist — see on enamikul laenuandjatel eliminatsioonikriteerium."
          : "Väike maksuvõlg tuvastatud. Likvideerige see enne taotluse esitamist, et saavutada 0 EUR tase.",
      related_criterion: taxDebt.label,
    });
  }

  // 4. Kontoväljavõtte mustrite puhastamine (raamatupidamise kvaliteet + käibe stabiilsus)
  const accountingQuality = findRule(breakdown, "accounting_quality");
  if (accountingQuality && accountingQuality.points < accountingQuality.weight) {
    items.push({
      category: "statement_cleanup",
      priority: priorityFor(accountingQuality.points, accountingQuality.weight),
      title: CATEGORY_LABELS.statement_cleanup,
      description:
        accountingQuality.points === 0
          ? "Raamatupidamine on ebajärjepidev ja sisaldab viiviseid. Tagage regulaarne, kuupõhine kannete tegemine ja kõrvaldage kõik olemasolevad viivised enne taotlust."
          : `Praegune raamatupidamise kvaliteet: "${accountingQuality.bandLabel}". Parandage järjepidevust või kõrvaldage viivised.`,
      related_criterion: accountingQuality.label,
    });
  }

  const revenueStability = findRule(breakdown, "revenue_stability");
  if (revenueStability && revenueStability.points < revenueStability.weight) {
    items.push({
      category: "statement_cleanup",
      priority: priorityFor(revenueStability.points, revenueStability.weight),
      title: CATEGORY_LABELS.statement_cleanup,
      description:
        revenueStability.points === 0
          ? "Käibe volatiilsus on kõrge ja trend langev. Dokumenteerige hooajalisuse põhjused pangale/laenuandjale ja koostage tegevuskava tulubaasi stabiliseerimiseks."
          : `Praegune käibe stabiilsus: "${revenueStability.bandLabel}". Stabiliseerige tulubaas või dokumenteerige hooajalisuse põhjused.`,
      related_criterion: revenueStability.label,
    });
  }

  // 5. Omakapitali tõstmine — üldine soovitus, kui üldine risk pole madal
  if (risk_level !== "madal") {
    items.push({
      category: "equity_increase",
      priority: (risk_level as RiskLevel) === "kõrge" ? "high" : "medium",
      title: CATEGORY_LABELS.equity_increase,
      description:
        "Kaaluge omakapitali suurendamist (omanike sissemakse, jaotamata kasumi säilitamine) — see parandab üldist finantsstabiilsust ja vähendab sõltuvust võõrkapitalist, mis on positiivne signaal kõigile laenuandjatele.",
      related_criterion: "Üldine riskitase",
    });
  }

  return items;
}
