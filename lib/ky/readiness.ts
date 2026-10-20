// KÜ valmisoleku loogika (Samm 7): puhas, ilma Netlify sõltuvuseta, et seda saaks kasutada
// nii /api/ky-readiness endpoint kui ka dokumendigeneraator (lib/documents).

import { scoreKY, type ScoringInput } from "../scoring";

export type EnergyLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "none";
export type TechnicalConsultantStatus = "engaged" | "not_engaged";
export type GeneralMeetingDecision = "two_thirds_majority" | "simple_majority" | "missing";

export interface KYReadinessInput {
  ky_debt_ratio: number; // 0-1
  maintenance_fund_coverage: number; // EUR/m2
  general_meeting_decision: GeneralMeetingDecision;
  energy_label: EnergyLabel;
  technical_consultant: TechnicalConsultantStatus;
}

export type CheckStatus = "ok" | "warning" | "blocked";

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface KYReadinessResult {
  overall_ready: boolean;
  score: number; // 0-100, Sammu 5 KÜ skoorimootorist
  risk_level: string;
  checklist: ChecklistItem[];
  next_steps: string[];
}

function checkGeneralMeeting(decision: GeneralMeetingDecision): ChecklistItem {
  if (decision === "two_thirds_majority") {
    return {
      id: "general_meeting",
      label: "Üldkoosoleku otsus",
      status: "ok",
      detail: "2/3 häälteenamus saavutatud — vastab enamiku laenuandjate nõudele.",
    };
  }
  if (decision === "simple_majority") {
    return {
      id: "general_meeting",
      label: "Üldkoosoleku otsus",
      status: "warning",
      detail:
        "Ainult lihthäälteenamus (50%) saavutatud. Osad laenuandjad võivad nõuda kõrgemat häälteenamust — kontrollige konkreetse laenutoote nõudeid.",
    };
  }
  return {
    id: "general_meeting",
    label: "Üldkoosoleku otsus",
    status: "blocked",
    detail: "Üldkoosoleku otsus puudub. See on eeltingimus igale KÜ laenu-/toetustaotlusele.",
  };
}

function checkMaintenanceFund(coverage: number): ChecklistItem {
  if (coverage >= 1.0) {
    return {
      id: "maintenance_fund",
      label: "Hooldusfondi kate",
      status: "ok",
      detail: `Kate ${coverage.toFixed(2)} EUR/m² — tugev tase.`,
    };
  }
  if (coverage >= 0.5) {
    return {
      id: "maintenance_fund",
      label: "Hooldusfondi kate",
      status: "warning",
      detail: `Kate ${coverage.toFixed(2)} EUR/m² — vastuvõetav, kuid madalam tase võib nõrgendada taotlust.`,
    };
  }
  return {
    id: "maintenance_fund",
    label: "Hooldusfondi kate",
    status: "blocked",
    detail: `Kate ${coverage.toFixed(2)} EUR/m² on alla 0.5 EUR/m² miinimumi — suurendage sissemakseid enne taotlust.`,
  };
}

function checkDebtRatio(ratio: number): ChecklistItem {
  if (ratio < 0.05) {
    return {
      id: "debt_ratio",
      label: "Liikmete võlgnevused",
      status: "ok",
      detail: `Võlgnevus ${(ratio * 100).toFixed(1)}% — alla 5% läve.`,
    };
  }
  if (ratio < 0.1) {
    return {
      id: "debt_ratio",
      label: "Liikmete võlgnevused",
      status: "warning",
      detail: `Võlgnevus ${(ratio * 100).toFixed(1)}% — 5-10% vahemikus, jälgitav risk.`,
    };
  }
  return {
    id: "debt_ratio",
    label: "Liikmete võlgnevused",
    status: "blocked",
    detail: `Võlgnevus ${(ratio * 100).toFixed(1)}% ületab 10% läve — enamik laenuandjaid lükkab taotluse tagasi sellel tasemel.`,
  };
}

function checkEnergyLabel(label: EnergyLabel): ChecklistItem {
  if (label === "none") {
    return {
      id: "energy_label",
      label: "Energiamärgis",
      status: "blocked",
      detail:
        "Energiamärgis puudub. Renoveerimislaenu/toetuse taotlus (EIS) eeldab kehtivat energiamärgist või energiaauditit.",
    };
  }
  const lowEfficiency = ["E", "F", "G"].includes(label);
  return {
    id: "energy_label",
    label: "Energiamärgis",
    status: lowEfficiency ? "warning" : "ok",
    detail: lowEfficiency
      ? `Energiamärgis ${label} — madal energiatõhusus, kuid see võib tegelikult tugevdada renoveerimislaenu põhjendust.`
      : `Energiamärgis ${label} olemas.`,
  };
}

function checkTechnicalConsultant(status: TechnicalConsultantStatus): ChecklistItem {
  if (status === "engaged") {
    return {
      id: "technical_consultant",
      label: "Tehniline konsultant",
      status: "ok",
      detail: "Tehniline konsultant on kaasatud.",
    };
  }
  return {
    id: "technical_consultant",
    label: "Tehniline konsultant",
    status: "warning",
    detail:
      "Tehniline konsultant pole veel kaasatud. Soovitatav suuremate renoveerimisprojektide korral tehnilise kirjelduse ja eelarve koostamiseks.",
  };
}

function buildNextSteps(checklist: ChecklistItem[]): string[] {
  const steps: string[] = [];
  const byId = (id: string) => checklist.find((c) => c.id === id)!;

  if (byId("general_meeting").status === "blocked") {
    steps.push(
      "Kutsuge kokku üldkoosolek ja saavutage otsus laenu/investeeringu kohta (soovitavalt 2/3 häälteenamusega).",
    );
  } else if (byId("general_meeting").status === "warning") {
    steps.push(
      "Kontrollige, kas sihtlaenuandja nõuab 2/3 häälteenamust — vajadusel kutsuge kokku uus üldkoosolek.",
    );
  }

  if (byId("energy_label").status === "blocked") {
    steps.push("Tellige sertifitseeritud eksperdilt energiaaudit ja energiamärgis.");
  }

  if (byId("technical_consultant").status === "warning") {
    steps.push("Kaasake tehniline konsultant projekti ettevalmistamiseks ja eelarve koostamiseks.");
  }

  if (byId("debt_ratio").status === "blocked") {
    steps.push("Vähendage liikmete võlgnevusi alla 10% (soovitavalt alla 5%) enne taotluse esitamist.");
  } else if (byId("debt_ratio").status === "warning") {
    steps.push("Jätkake võlgnevuste sissenõudmist, et jõuda alla 5% taseme.");
  }

  if (byId("maintenance_fund").status === "blocked") {
    steps.push("Suurendage hooldusfondi sissemakseid, et tõsta kate vähemalt 0.5 EUR/m² tasemele.");
  } else if (byId("maintenance_fund").status === "warning") {
    steps.push("Kaaluge hooldusfondi sissemaksete suurendamist üle 1.0 EUR/m² taseme, tugevamaks taotluseks.");
  }

  const blocked = checklist.some((c) => c.status === "blocked");
  if (!blocked) {
    steps.push(
      "Koostage taotlusdokumendid (üldkoosoleku protokoll, hooldusfondi väljavõte, energiamärgis, tehniline kirjeldus) ja esitage taotlus EIS portaali kaudu.",
    );
  } else {
    steps.push(
      "Kõrvaldage ülaltoodud blokeerivad puudujäägid enne EIS taotluse esitamist.",
    );
  }

  return steps;
}

export function checkKYReadiness(input: KYReadinessInput): KYReadinessResult {
  const checklist: ChecklistItem[] = [
    checkGeneralMeeting(input.general_meeting_decision),
    checkMaintenanceFund(input.maintenance_fund_coverage),
    checkDebtRatio(input.ky_debt_ratio),
    checkEnergyLabel(input.energy_label),
    checkTechnicalConsultant(input.technical_consultant),
  ];

  const scoringInput: ScoringInput = {
    ky_debt_ratio: input.ky_debt_ratio,
    maintenance_fund_coverage: input.maintenance_fund_coverage,
    general_meeting_decision: input.general_meeting_decision,
  };
  const scoringResult = scoreKY(scoringInput);

  const overall_ready = !checklist.some((c) => c.status === "blocked");
  const next_steps = buildNextSteps(checklist);

  return {
    overall_ready,
    score: scoringResult.score,
    risk_level: scoringResult.risk_level,
    checklist,
    next_steps,
  };
}
