"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/ky-readiness/index.ts
var index_exports = {};
__export(index_exports, {
  checkKYReadiness: () => checkKYReadiness,
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(index_exports);

// lib/scoring/rules.ts
var KY_SCORING_RULES = [
  {
    id: "ky_debt_ratio",
    label: "K\xDC liikmete v\xF5lgnevused (% majanduskuludest)",
    type: "numeric_interval",
    weight: 30,
    unit: "ratio",
    bands: [
      { min: -Infinity, max: 0.05, points: 30, label: "< 5%" },
      { min: 0.05, max: 0.1, points: 15, label: "5 - 10%" },
      { min: 0.1, max: Infinity, points: 0, label: ">= 10%" }
    ]
  },
  {
    id: "maintenance_fund_coverage",
    label: "Hooldusfondi kate (EUR/m\xB2)",
    type: "numeric_interval",
    weight: 30,
    unit: "EUR/m2",
    bands: [
      { min: 1, max: Infinity, points: 30, label: ">= 1.0 EUR/m\xB2" },
      { min: 0.5, max: 1, points: 15, label: "0.5 - 1.0 EUR/m\xB2" },
      { min: -Infinity, max: 0.5, points: 0, label: "< 0.5 EUR/m\xB2" }
    ]
  },
  {
    id: "general_meeting_decision",
    label: "\xDCldkoosoleku otsus laenu/investeeringu kohta",
    type: "categorical",
    weight: 40,
    bands: [
      { key: "two_thirds_majority", points: 40, label: "2/3 h\xE4\xE4lteenamus" },
      { key: "simple_majority", points: 20, label: "50% (lihth\xE4\xE4lteenamus)" },
      { key: "missing", points: 0, label: "Otsus puudub" }
    ]
  }
];
function matchNumericBand(rule, value) {
  for (const band of rule.bands) {
    if (band.min === band.max) {
      if (value === band.min) return band;
    } else if (value >= band.min && value < band.max) {
      return band;
    }
  }
  return rule.bands[rule.bands.length - 1];
}
function matchCategoricalBand(rule, key) {
  return rule.bands.find((b) => b.key === key);
}

// lib/scoring/index.ts
var RISK_THRESHOLDS = {
  madal: 70,
  // score >= 70
  keskmine: 40
  // 40 <= score < 70
  // score < 40 => kõrge
};
var STRENGTH_RATIO = 0.8;
var WEAKNESS_RATIO = 0.3;
function computeScore(rules, input) {
  const breakdown = [];
  const missing = [];
  const invalid = [];
  for (const rule of rules) {
    const rawValue = input[rule.id];
    if (rawValue === void 0 || rawValue === null) {
      missing.push(rule.id);
      continue;
    }
    if (rule.type === "numeric_interval") {
      if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
        invalid.push(`${rule.id}: oodati numbrit, saadi "${rawValue}"`);
        continue;
      }
      const band = matchNumericBand(rule, rawValue);
      breakdown.push({
        id: rule.id,
        label: rule.label,
        weight: rule.weight,
        points: band.points,
        bandLabel: band.label
      });
    } else {
      if (typeof rawValue !== "string") {
        invalid.push(`${rule.id}: oodati stringi (kategooria v\xF5ti), saadi "${rawValue}"`);
        continue;
      }
      const band = matchCategoricalBand(rule, rawValue);
      if (!band) {
        const validKeys = rule.bands.map((b) => b.key).join(", ");
        invalid.push(`${rule.id}: tundmatu kategooria "${rawValue}" (lubatud: ${validKeys})`);
        continue;
      }
      breakdown.push({
        id: rule.id,
        label: rule.label,
        weight: rule.weight,
        points: band.points,
        bandLabel: band.label
      });
    }
  }
  if (missing.length > 0 || invalid.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`Puuduvad v\xE4ljad: ${missing.join(", ")}`);
    if (invalid.length > 0) parts.push(`Vigased v\xE4\xE4rtused: ${invalid.join("; ")}`);
    throw new Error(parts.join(" | "));
  }
  const score = breakdown.reduce((sum, b) => sum + b.points, 0);
  const risk_level = score >= RISK_THRESHOLDS.madal ? "madal" : score >= RISK_THRESHOLDS.keskmine ? "keskmine" : "k\xF5rge";
  const strengths = breakdown.filter((b) => b.weight > 0 && b.points / b.weight >= STRENGTH_RATIO).map((b) => `${b.label}: ${b.bandLabel}`);
  const weaknesses = breakdown.filter((b) => b.weight > 0 && b.points / b.weight <= WEAKNESS_RATIO).map((b) => `${b.label}: ${b.bandLabel}`);
  return { score, risk_level, strengths, weaknesses, breakdown };
}
function scoreKY(input) {
  return computeScore(KY_SCORING_RULES, input);
}

// api/ky-readiness/index.ts
var config = {
  path: "/api/ky-readiness"
};
function checkGeneralMeeting(decision) {
  if (decision === "two_thirds_majority") {
    return {
      id: "general_meeting",
      label: "\xDCldkoosoleku otsus",
      status: "ok",
      detail: "2/3 h\xE4\xE4lteenamus saavutatud \u2014 vastab enamiku laenuandjate n\xF5udele."
    };
  }
  if (decision === "simple_majority") {
    return {
      id: "general_meeting",
      label: "\xDCldkoosoleku otsus",
      status: "warning",
      detail: "Ainult lihth\xE4\xE4lteenamus (50%) saavutatud. Osad laenuandjad (sh KredEx suuremate summade puhul) n\xF5uavad 2/3 h\xE4\xE4lteenamust \u2014 kontrollige konkreetse toote n\xF5udeid."
    };
  }
  return {
    id: "general_meeting",
    label: "\xDCldkoosoleku otsus",
    status: "blocked",
    detail: "\xDCldkoosoleku otsus puudub. See on eeltingimus igale K\xDC laenu-/toetustaotlusele."
  };
}
function checkMaintenanceFund(coverage) {
  if (coverage >= 1) {
    return {
      id: "maintenance_fund",
      label: "Hooldusfondi kate",
      status: "ok",
      detail: `Kate ${coverage.toFixed(2)} EUR/m\xB2 \u2014 tugev tase.`
    };
  }
  if (coverage >= 0.5) {
    return {
      id: "maintenance_fund",
      label: "Hooldusfondi kate",
      status: "warning",
      detail: `Kate ${coverage.toFixed(2)} EUR/m\xB2 \u2014 vastuv\xF5etav, kuid madalam tase v\xF5ib n\xF5rgendada taotlust.`
    };
  }
  return {
    id: "maintenance_fund",
    label: "Hooldusfondi kate",
    status: "blocked",
    detail: `Kate ${coverage.toFixed(2)} EUR/m\xB2 on alla 0.5 EUR/m\xB2 miinimumi \u2014 suurendage sissemakseid enne taotlust.`
  };
}
function checkDebtRatio(ratio) {
  if (ratio < 0.05) {
    return {
      id: "debt_ratio",
      label: "Liikmete v\xF5lgnevused",
      status: "ok",
      detail: `V\xF5lgnevus ${(ratio * 100).toFixed(1)}% \u2014 alla 5% l\xE4ve.`
    };
  }
  if (ratio < 0.1) {
    return {
      id: "debt_ratio",
      label: "Liikmete v\xF5lgnevused",
      status: "warning",
      detail: `V\xF5lgnevus ${(ratio * 100).toFixed(1)}% \u2014 5-10% vahemikus, j\xE4lgitav risk.`
    };
  }
  return {
    id: "debt_ratio",
    label: "Liikmete v\xF5lgnevused",
    status: "blocked",
    detail: `V\xF5lgnevus ${(ratio * 100).toFixed(1)}% \xFCletab 10% l\xE4ve \u2014 enamik laenuandjaid l\xFCkkab taotluse tagasi sellel tasemel.`
  };
}
function checkEnergyLabel(label) {
  if (label === "none") {
    return {
      id: "energy_label",
      label: "Energiam\xE4rgis",
      status: "blocked",
      detail: "Energiam\xE4rgis puudub. Renoveerimislaenu/toetuse taotlus (KredEx/EIS) eeldab kehtivat energiam\xE4rgist v\xF5i energiaauditit."
    };
  }
  const lowEfficiency = ["E", "F", "G"].includes(label);
  return {
    id: "energy_label",
    label: "Energiam\xE4rgis",
    status: lowEfficiency ? "warning" : "ok",
    detail: lowEfficiency ? `Energiam\xE4rgis ${label} \u2014 madal energiat\xF5husus, kuid see v\xF5ib tegelikult tugevdada renoveerimislaenu p\xF5hjendust.` : `Energiam\xE4rgis ${label} olemas.`
  };
}
function checkTechnicalConsultant(status) {
  if (status === "engaged") {
    return {
      id: "technical_consultant",
      label: "Tehniline konsultant",
      status: "ok",
      detail: "Tehniline konsultant on kaasatud."
    };
  }
  return {
    id: "technical_consultant",
    label: "Tehniline konsultant",
    status: "warning",
    detail: "Tehniline konsultant pole veel kaasatud. Soovitatav suuremate renoveerimisprojektide korral tehnilise kirjelduse ja eelarve koostamiseks."
  };
}
function buildNextSteps(checklist) {
  const steps = [];
  const byId = (id) => checklist.find((c) => c.id === id);
  if (byId("general_meeting").status === "blocked") {
    steps.push(
      "Kutsuge kokku \xFCldkoosolek ja saavutage otsus laenu/investeeringu kohta (soovitavalt 2/3 h\xE4\xE4lteenamusega)."
    );
  } else if (byId("general_meeting").status === "warning") {
    steps.push(
      "Kontrollige, kas sihtlaenuandja n\xF5uab 2/3 h\xE4\xE4lteenamust \u2014 vajadusel kutsuge kokku uus \xFCldkoosolek."
    );
  }
  if (byId("energy_label").status === "blocked") {
    steps.push("Tellige sertifitseeritud eksperdilt energiaaudit ja energiam\xE4rgis.");
  }
  if (byId("technical_consultant").status === "warning") {
    steps.push("Kaasake tehniline konsultant projekti ettevalmistamiseks ja eelarve koostamiseks.");
  }
  if (byId("debt_ratio").status === "blocked") {
    steps.push("V\xE4hendage liikmete v\xF5lgnevusi alla 10% (soovitavalt alla 5%) enne taotluse esitamist.");
  } else if (byId("debt_ratio").status === "warning") {
    steps.push("J\xE4tkake v\xF5lgnevuste sissen\xF5udmist, et j\xF5uda alla 5% taseme.");
  }
  if (byId("maintenance_fund").status === "blocked") {
    steps.push("Suurendage hooldusfondi sissemakseid, et t\xF5sta kate v\xE4hemalt 0.5 EUR/m\xB2 tasemele.");
  } else if (byId("maintenance_fund").status === "warning") {
    steps.push("Kaaluge hooldusfondi sissemaksete suurendamist \xFCle 1.0 EUR/m\xB2 taseme, tugevamaks taotluseks.");
  }
  const blocked = checklist.some((c) => c.status === "blocked");
  if (!blocked) {
    steps.push(
      "Koostage taotlusdokumendid (\xFCldkoosoleku protokoll, hooldusfondi v\xE4ljav\xF5te, energiam\xE4rgis, tehniline kirjeldus) ja esitage taotlus KredEx/EIS portaali kaudu."
    );
  } else {
    steps.push(
      "K\xF5rvaldage \xFClaltoodud blokeerivad puuduj\xE4\xE4gid enne KredEx/EIS taotluse esitamist."
    );
  }
  return steps;
}
function checkKYReadiness(input) {
  const checklist = [
    checkGeneralMeeting(input.general_meeting_decision),
    checkMaintenanceFund(input.maintenance_fund_coverage),
    checkDebtRatio(input.ky_debt_ratio),
    checkEnergyLabel(input.energy_label),
    checkTechnicalConsultant(input.technical_consultant)
  ];
  const scoringInput = {
    ky_debt_ratio: input.ky_debt_ratio,
    maintenance_fund_coverage: input.maintenance_fund_coverage,
    general_meeting_decision: input.general_meeting_decision
  };
  const scoringResult = scoreKY(scoringInput);
  const overall_ready = !checklist.some((c) => c.status === "blocked");
  const next_steps = buildNextSteps(checklist);
  return {
    overall_ready,
    score: scoringResult.score,
    risk_level: scoringResult.risk_level,
    checklist,
    next_steps
  };
}
async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  let input;
  try {
    input = await req.json();
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }
  const required = [
    "ky_debt_ratio",
    "maintenance_fund_coverage",
    "general_meeting_decision",
    "energy_label",
    "technical_consultant"
  ];
  const missing = required.filter((k) => input[k] === void 0);
  if (missing.length > 0) {
    return jsonResponse({ error: `Puuduvad v\xE4ljad: ${missing.join(", ")}` }, 400);
  }
  try {
    const result = checkKYReadiness(input);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse({ error: "Valmisoleku kontroll eba\xF5nnestus", detail: String(err) }, 500);
  }
}
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkKYReadiness,
  config
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpL2t5LXJlYWRpbmVzcy9pbmRleC50cyIsICJsaWIvc2NvcmluZy9ydWxlcy50cyIsICJsaWIvc2NvcmluZy9pbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gTmV0bGlmeSBGdW5jdGlvbiAodjIsIFdlYiBBUEkgaGFuZGxlcilcbi8vIFNhbW0gNzogS1x1MDBEQyB2YWxtaXNvbGVrdSBrb250cm9sbFxuLy8gS29udHJvbGxpYjogXHUwMEZDbGRrb29zb2xla3Ugb3RzdXMsIGhvb2xkdXNmb25kLCB2XHUwMEY1bGduZXZ1c2VkLCBlbmVyZ2lhbVx1MDBFNHJnaXMsIHRlaG5pbGluZSBrb25zdWx0YW50XG4vLyBUYWdhc3RhYjogY2hlY2tsaXN0IChvay93YXJuaW5nL2Jsb2NrZWQgaWdhIGtyaXRlZXJpdW1pIGtvaHRhKSArIHNhbW0tc2FtbXVsaW5lIHRlZSBLcmVkRXgvRUlTIHRhb3RsdXNlbmlcblxuaW1wb3J0IHsgc2NvcmVLWSwgdHlwZSBTY29yaW5nSW5wdXQgfSBmcm9tIFwiLi4vLi4vbGliL3Njb3JpbmdcIjtcblxuZXhwb3J0IGNvbnN0IGNvbmZpZyA9IHtcbiAgcGF0aDogXCIvYXBpL2t5LXJlYWRpbmVzc1wiLFxufTtcblxuZXhwb3J0IHR5cGUgRW5lcmd5TGFiZWwgPSBcIkFcIiB8IFwiQlwiIHwgXCJDXCIgfCBcIkRcIiB8IFwiRVwiIHwgXCJGXCIgfCBcIkdcIiB8IFwibm9uZVwiO1xuZXhwb3J0IHR5cGUgVGVjaG5pY2FsQ29uc3VsdGFudFN0YXR1cyA9IFwiZW5nYWdlZFwiIHwgXCJub3RfZW5nYWdlZFwiO1xuZXhwb3J0IHR5cGUgR2VuZXJhbE1lZXRpbmdEZWNpc2lvbiA9IFwidHdvX3RoaXJkc19tYWpvcml0eVwiIHwgXCJzaW1wbGVfbWFqb3JpdHlcIiB8IFwibWlzc2luZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEtZUmVhZGluZXNzSW5wdXQge1xuICBreV9kZWJ0X3JhdGlvOiBudW1iZXI7IC8vIDAtMVxuICBtYWludGVuYW5jZV9mdW5kX2NvdmVyYWdlOiBudW1iZXI7IC8vIEVVUi9tMlxuICBnZW5lcmFsX21lZXRpbmdfZGVjaXNpb246IEdlbmVyYWxNZWV0aW5nRGVjaXNpb247XG4gIGVuZXJneV9sYWJlbDogRW5lcmd5TGFiZWw7XG4gIHRlY2huaWNhbF9jb25zdWx0YW50OiBUZWNobmljYWxDb25zdWx0YW50U3RhdHVzO1xufVxuXG5leHBvcnQgdHlwZSBDaGVja1N0YXR1cyA9IFwib2tcIiB8IFwid2FybmluZ1wiIHwgXCJibG9ja2VkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hlY2tsaXN0SXRlbSB7XG4gIGlkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHN0YXR1czogQ2hlY2tTdGF0dXM7XG4gIGRldGFpbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEtZUmVhZGluZXNzUmVzdWx0IHtcbiAgb3ZlcmFsbF9yZWFkeTogYm9vbGVhbjtcbiAgc2NvcmU6IG51bWJlcjsgLy8gMC0xMDAsIFNhbW11IDUgS1x1MDBEQyBza29vcmltb290b3Jpc3RcbiAgcmlza19sZXZlbDogc3RyaW5nO1xuICBjaGVja2xpc3Q6IENoZWNrbGlzdEl0ZW1bXTtcbiAgbmV4dF9zdGVwczogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGNoZWNrR2VuZXJhbE1lZXRpbmcoZGVjaXNpb246IEdlbmVyYWxNZWV0aW5nRGVjaXNpb24pOiBDaGVja2xpc3RJdGVtIHtcbiAgaWYgKGRlY2lzaW9uID09PSBcInR3b190aGlyZHNfbWFqb3JpdHlcIikge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogXCJnZW5lcmFsX21lZXRpbmdcIixcbiAgICAgIGxhYmVsOiBcIlx1MDBEQ2xka29vc29sZWt1IG90c3VzXCIsXG4gICAgICBzdGF0dXM6IFwib2tcIixcbiAgICAgIGRldGFpbDogXCIyLzMgaFx1MDBFNFx1MDBFNGx0ZWVuYW11cyBzYWF2dXRhdHVkIFx1MjAxNCB2YXN0YWIgZW5hbWlrdSBsYWVudWFuZGphdGUgblx1MDBGNXVkZWxlLlwiLFxuICAgIH07XG4gIH1cbiAgaWYgKGRlY2lzaW9uID09PSBcInNpbXBsZV9tYWpvcml0eVwiKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBcImdlbmVyYWxfbWVldGluZ1wiLFxuICAgICAgbGFiZWw6IFwiXHUwMERDbGRrb29zb2xla3Ugb3RzdXNcIixcbiAgICAgIHN0YXR1czogXCJ3YXJuaW5nXCIsXG4gICAgICBkZXRhaWw6XG4gICAgICAgIFwiQWludWx0IGxpaHRoXHUwMEU0XHUwMEU0bHRlZW5hbXVzICg1MCUpIHNhYXZ1dGF0dWQuIE9zYWQgbGFlbnVhbmRqYWQgKHNoIEtyZWRFeCBzdXVyZW1hdGUgc3VtbWFkZSBwdWh1bCkgblx1MDBGNXVhdmFkIDIvMyBoXHUwMEU0XHUwMEU0bHRlZW5hbXVzdCBcdTIwMTQga29udHJvbGxpZ2Uga29ua3JlZXRzZSB0b290ZSBuXHUwMEY1dWRlaWQuXCIsXG4gICAgfTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGlkOiBcImdlbmVyYWxfbWVldGluZ1wiLFxuICAgIGxhYmVsOiBcIlx1MDBEQ2xka29vc29sZWt1IG90c3VzXCIsXG4gICAgc3RhdHVzOiBcImJsb2NrZWRcIixcbiAgICBkZXRhaWw6IFwiXHUwMERDbGRrb29zb2xla3Ugb3RzdXMgcHV1ZHViLiBTZWUgb24gZWVsdGluZ2ltdXMgaWdhbGUgS1x1MDBEQyBsYWVudS0vdG9ldHVzdGFvdGx1c2VsZS5cIixcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tNYWludGVuYW5jZUZ1bmQoY292ZXJhZ2U6IG51bWJlcik6IENoZWNrbGlzdEl0ZW0ge1xuICBpZiAoY292ZXJhZ2UgPj0gMS4wKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBcIm1haW50ZW5hbmNlX2Z1bmRcIixcbiAgICAgIGxhYmVsOiBcIkhvb2xkdXNmb25kaSBrYXRlXCIsXG4gICAgICBzdGF0dXM6IFwib2tcIixcbiAgICAgIGRldGFpbDogYEthdGUgJHtjb3ZlcmFnZS50b0ZpeGVkKDIpfSBFVVIvbVx1MDBCMiBcdTIwMTQgdHVnZXYgdGFzZS5gLFxuICAgIH07XG4gIH1cbiAgaWYgKGNvdmVyYWdlID49IDAuNSkge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogXCJtYWludGVuYW5jZV9mdW5kXCIsXG4gICAgICBsYWJlbDogXCJIb29sZHVzZm9uZGkga2F0ZVwiLFxuICAgICAgc3RhdHVzOiBcIndhcm5pbmdcIixcbiAgICAgIGRldGFpbDogYEthdGUgJHtjb3ZlcmFnZS50b0ZpeGVkKDIpfSBFVVIvbVx1MDBCMiBcdTIwMTQgdmFzdHV2XHUwMEY1ZXRhdiwga3VpZCBtYWRhbGFtIHRhc2Ugdlx1MDBGNWliIG5cdTAwRjVyZ2VuZGFkYSB0YW90bHVzdC5gLFxuICAgIH07XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBpZDogXCJtYWludGVuYW5jZV9mdW5kXCIsXG4gICAgbGFiZWw6IFwiSG9vbGR1c2ZvbmRpIGthdGVcIixcbiAgICBzdGF0dXM6IFwiYmxvY2tlZFwiLFxuICAgIGRldGFpbDogYEthdGUgJHtjb3ZlcmFnZS50b0ZpeGVkKDIpfSBFVVIvbVx1MDBCMiBvbiBhbGxhIDAuNSBFVVIvbVx1MDBCMiBtaWluaW11bWkgXHUyMDE0IHN1dXJlbmRhZ2Ugc2lzc2VtYWtzZWlkIGVubmUgdGFvdGx1c3QuYCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tEZWJ0UmF0aW8ocmF0aW86IG51bWJlcik6IENoZWNrbGlzdEl0ZW0ge1xuICBpZiAocmF0aW8gPCAwLjA1KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBcImRlYnRfcmF0aW9cIixcbiAgICAgIGxhYmVsOiBcIkxpaWttZXRlIHZcdTAwRjVsZ25ldnVzZWRcIixcbiAgICAgIHN0YXR1czogXCJva1wiLFxuICAgICAgZGV0YWlsOiBgVlx1MDBGNWxnbmV2dXMgJHsocmF0aW8gKiAxMDApLnRvRml4ZWQoMSl9JSBcdTIwMTQgYWxsYSA1JSBsXHUwMEU0dmUuYCxcbiAgICB9O1xuICB9XG4gIGlmIChyYXRpbyA8IDAuMSkge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogXCJkZWJ0X3JhdGlvXCIsXG4gICAgICBsYWJlbDogXCJMaWlrbWV0ZSB2XHUwMEY1bGduZXZ1c2VkXCIsXG4gICAgICBzdGF0dXM6IFwid2FybmluZ1wiLFxuICAgICAgZGV0YWlsOiBgVlx1MDBGNWxnbmV2dXMgJHsocmF0aW8gKiAxMDApLnRvRml4ZWQoMSl9JSBcdTIwMTQgNS0xMCUgdmFoZW1pa3VzLCBqXHUwMEU0bGdpdGF2IHJpc2suYCxcbiAgICB9O1xuICB9XG4gIHJldHVybiB7XG4gICAgaWQ6IFwiZGVidF9yYXRpb1wiLFxuICAgIGxhYmVsOiBcIkxpaWttZXRlIHZcdTAwRjVsZ25ldnVzZWRcIixcbiAgICBzdGF0dXM6IFwiYmxvY2tlZFwiLFxuICAgIGRldGFpbDogYFZcdTAwRjVsZ25ldnVzICR7KHJhdGlvICogMTAwKS50b0ZpeGVkKDEpfSUgXHUwMEZDbGV0YWIgMTAlIGxcdTAwRTR2ZSBcdTIwMTQgZW5hbWlrIGxhZW51YW5kamFpZCBsXHUwMEZDa2thYiB0YW90bHVzZSB0YWdhc2kgc2VsbGVsIHRhc2VtZWwuYCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tFbmVyZ3lMYWJlbChsYWJlbDogRW5lcmd5TGFiZWwpOiBDaGVja2xpc3RJdGVtIHtcbiAgaWYgKGxhYmVsID09PSBcIm5vbmVcIikge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogXCJlbmVyZ3lfbGFiZWxcIixcbiAgICAgIGxhYmVsOiBcIkVuZXJnaWFtXHUwMEU0cmdpc1wiLFxuICAgICAgc3RhdHVzOiBcImJsb2NrZWRcIixcbiAgICAgIGRldGFpbDpcbiAgICAgICAgXCJFbmVyZ2lhbVx1MDBFNHJnaXMgcHV1ZHViLiBSZW5vdmVlcmltaXNsYWVudS90b2V0dXNlIHRhb3RsdXMgKEtyZWRFeC9FSVMpIGVlbGRhYiBrZWh0aXZhdCBlbmVyZ2lhbVx1MDBFNHJnaXN0IHZcdTAwRjVpIGVuZXJnaWFhdWRpdGl0LlwiLFxuICAgIH07XG4gIH1cbiAgY29uc3QgbG93RWZmaWNpZW5jeSA9IFtcIkVcIiwgXCJGXCIsIFwiR1wiXS5pbmNsdWRlcyhsYWJlbCk7XG4gIHJldHVybiB7XG4gICAgaWQ6IFwiZW5lcmd5X2xhYmVsXCIsXG4gICAgbGFiZWw6IFwiRW5lcmdpYW1cdTAwRTRyZ2lzXCIsXG4gICAgc3RhdHVzOiBsb3dFZmZpY2llbmN5ID8gXCJ3YXJuaW5nXCIgOiBcIm9rXCIsXG4gICAgZGV0YWlsOiBsb3dFZmZpY2llbmN5XG4gICAgICA/IGBFbmVyZ2lhbVx1MDBFNHJnaXMgJHtsYWJlbH0gXHUyMDE0IG1hZGFsIGVuZXJnaWF0XHUwMEY1aHVzdXMsIGt1aWQgc2VlIHZcdTAwRjVpYiB0ZWdlbGlrdWx0IHR1Z2V2ZGFkYSByZW5vdmVlcmltaXNsYWVudSBwXHUwMEY1aGplbmR1c3QuYFxuICAgICAgOiBgRW5lcmdpYW1cdTAwRTRyZ2lzICR7bGFiZWx9IG9sZW1hcy5gLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjaGVja1RlY2huaWNhbENvbnN1bHRhbnQoc3RhdHVzOiBUZWNobmljYWxDb25zdWx0YW50U3RhdHVzKTogQ2hlY2tsaXN0SXRlbSB7XG4gIGlmIChzdGF0dXMgPT09IFwiZW5nYWdlZFwiKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBcInRlY2huaWNhbF9jb25zdWx0YW50XCIsXG4gICAgICBsYWJlbDogXCJUZWhuaWxpbmUga29uc3VsdGFudFwiLFxuICAgICAgc3RhdHVzOiBcIm9rXCIsXG4gICAgICBkZXRhaWw6IFwiVGVobmlsaW5lIGtvbnN1bHRhbnQgb24ga2Fhc2F0dWQuXCIsXG4gICAgfTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGlkOiBcInRlY2huaWNhbF9jb25zdWx0YW50XCIsXG4gICAgbGFiZWw6IFwiVGVobmlsaW5lIGtvbnN1bHRhbnRcIixcbiAgICBzdGF0dXM6IFwid2FybmluZ1wiLFxuICAgIGRldGFpbDpcbiAgICAgIFwiVGVobmlsaW5lIGtvbnN1bHRhbnQgcG9sZSB2ZWVsIGthYXNhdHVkLiBTb292aXRhdGF2IHN1dXJlbWF0ZSByZW5vdmVlcmltaXNwcm9qZWt0aWRlIGtvcnJhbCB0ZWhuaWxpc2Uga2lyamVsZHVzZSBqYSBlZWxhcnZlIGtvb3N0YW1pc2Vrcy5cIixcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGROZXh0U3RlcHMoY2hlY2tsaXN0OiBDaGVja2xpc3RJdGVtW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHN0ZXBzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBieUlkID0gKGlkOiBzdHJpbmcpID0+IGNoZWNrbGlzdC5maW5kKChjKSA9PiBjLmlkID09PSBpZCkhO1xuXG4gIGlmIChieUlkKFwiZ2VuZXJhbF9tZWV0aW5nXCIpLnN0YXR1cyA9PT0gXCJibG9ja2VkXCIpIHtcbiAgICBzdGVwcy5wdXNoKFxuICAgICAgXCJLdXRzdWdlIGtva2t1IFx1MDBGQ2xka29vc29sZWsgamEgc2FhdnV0YWdlIG90c3VzIGxhZW51L2ludmVzdGVlcmluZ3Uga29odGEgKHNvb3ZpdGF2YWx0IDIvMyBoXHUwMEU0XHUwMEU0bHRlZW5hbXVzZWdhKS5cIixcbiAgICApO1xuICB9IGVsc2UgaWYgKGJ5SWQoXCJnZW5lcmFsX21lZXRpbmdcIikuc3RhdHVzID09PSBcIndhcm5pbmdcIikge1xuICAgIHN0ZXBzLnB1c2goXG4gICAgICBcIktvbnRyb2xsaWdlLCBrYXMgc2lodGxhZW51YW5kamEgblx1MDBGNXVhYiAyLzMgaFx1MDBFNFx1MDBFNGx0ZWVuYW11c3QgXHUyMDE0IHZhamFkdXNlbCBrdXRzdWdlIGtva2t1IHV1cyBcdTAwRkNsZGtvb3NvbGVrLlwiLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnlJZChcImVuZXJneV9sYWJlbFwiKS5zdGF0dXMgPT09IFwiYmxvY2tlZFwiKSB7XG4gICAgc3RlcHMucHVzaChcIlRlbGxpZ2Ugc2VydGlmaXRzZWVyaXR1ZCBla3NwZXJkaWx0IGVuZXJnaWFhdWRpdCBqYSBlbmVyZ2lhbVx1MDBFNHJnaXMuXCIpO1xuICB9XG5cbiAgaWYgKGJ5SWQoXCJ0ZWNobmljYWxfY29uc3VsdGFudFwiKS5zdGF0dXMgPT09IFwid2FybmluZ1wiKSB7XG4gICAgc3RlcHMucHVzaChcIkthYXNha2UgdGVobmlsaW5lIGtvbnN1bHRhbnQgcHJvamVrdGkgZXR0ZXZhbG1pc3RhbWlzZWtzIGphIGVlbGFydmUga29vc3RhbWlzZWtzLlwiKTtcbiAgfVxuXG4gIGlmIChieUlkKFwiZGVidF9yYXRpb1wiKS5zdGF0dXMgPT09IFwiYmxvY2tlZFwiKSB7XG4gICAgc3RlcHMucHVzaChcIlZcdTAwRTRoZW5kYWdlIGxpaWttZXRlIHZcdTAwRjVsZ25ldnVzaSBhbGxhIDEwJSAoc29vdml0YXZhbHQgYWxsYSA1JSkgZW5uZSB0YW90bHVzZSBlc2l0YW1pc3QuXCIpO1xuICB9IGVsc2UgaWYgKGJ5SWQoXCJkZWJ0X3JhdGlvXCIpLnN0YXR1cyA9PT0gXCJ3YXJuaW5nXCIpIHtcbiAgICBzdGVwcy5wdXNoKFwiSlx1MDBFNHRrYWtlIHZcdTAwRjVsZ25ldnVzdGUgc2lzc2VuXHUwMEY1dWRtaXN0LCBldCBqXHUwMEY1dWRhIGFsbGEgNSUgdGFzZW1lLlwiKTtcbiAgfVxuXG4gIGlmIChieUlkKFwibWFpbnRlbmFuY2VfZnVuZFwiKS5zdGF0dXMgPT09IFwiYmxvY2tlZFwiKSB7XG4gICAgc3RlcHMucHVzaChcIlN1dXJlbmRhZ2UgaG9vbGR1c2ZvbmRpIHNpc3NlbWFrc2VpZCwgZXQgdFx1MDBGNXN0YSBrYXRlIHZcdTAwRTRoZW1hbHQgMC41IEVVUi9tXHUwMEIyIHRhc2VtZWxlLlwiKTtcbiAgfSBlbHNlIGlmIChieUlkKFwibWFpbnRlbmFuY2VfZnVuZFwiKS5zdGF0dXMgPT09IFwid2FybmluZ1wiKSB7XG4gICAgc3RlcHMucHVzaChcIkthYWx1Z2UgaG9vbGR1c2ZvbmRpIHNpc3NlbWFrc2V0ZSBzdXVyZW5kYW1pc3QgXHUwMEZDbGUgMS4wIEVVUi9tXHUwMEIyIHRhc2VtZSwgdHVnZXZhbWFrcyB0YW90bHVzZWtzLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGJsb2NrZWQgPSBjaGVja2xpc3Quc29tZSgoYykgPT4gYy5zdGF0dXMgPT09IFwiYmxvY2tlZFwiKTtcbiAgaWYgKCFibG9ja2VkKSB7XG4gICAgc3RlcHMucHVzaChcbiAgICAgIFwiS29vc3RhZ2UgdGFvdGx1c2Rva3VtZW5kaWQgKFx1MDBGQ2xka29vc29sZWt1IHByb3Rva29sbCwgaG9vbGR1c2ZvbmRpIHZcdTAwRTRsamF2XHUwMEY1dGUsIGVuZXJnaWFtXHUwMEU0cmdpcywgdGVobmlsaW5lIGtpcmplbGR1cykgamEgZXNpdGFnZSB0YW90bHVzIEtyZWRFeC9FSVMgcG9ydGFhbGkga2F1ZHUuXCIsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICBzdGVwcy5wdXNoKFxuICAgICAgXCJLXHUwMEY1cnZhbGRhZ2UgXHUwMEZDbGFsdG9vZHVkIGJsb2tlZXJpdmFkIHB1dWR1alx1MDBFNFx1MDBFNGdpZCBlbm5lIEtyZWRFeC9FSVMgdGFvdGx1c2UgZXNpdGFtaXN0LlwiLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gc3RlcHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0tZUmVhZGluZXNzKGlucHV0OiBLWVJlYWRpbmVzc0lucHV0KTogS1lSZWFkaW5lc3NSZXN1bHQge1xuICBjb25zdCBjaGVja2xpc3Q6IENoZWNrbGlzdEl0ZW1bXSA9IFtcbiAgICBjaGVja0dlbmVyYWxNZWV0aW5nKGlucHV0LmdlbmVyYWxfbWVldGluZ19kZWNpc2lvbiksXG4gICAgY2hlY2tNYWludGVuYW5jZUZ1bmQoaW5wdXQubWFpbnRlbmFuY2VfZnVuZF9jb3ZlcmFnZSksXG4gICAgY2hlY2tEZWJ0UmF0aW8oaW5wdXQua3lfZGVidF9yYXRpbyksXG4gICAgY2hlY2tFbmVyZ3lMYWJlbChpbnB1dC5lbmVyZ3lfbGFiZWwpLFxuICAgIGNoZWNrVGVjaG5pY2FsQ29uc3VsdGFudChpbnB1dC50ZWNobmljYWxfY29uc3VsdGFudCksXG4gIF07XG5cbiAgY29uc3Qgc2NvcmluZ0lucHV0OiBTY29yaW5nSW5wdXQgPSB7XG4gICAga3lfZGVidF9yYXRpbzogaW5wdXQua3lfZGVidF9yYXRpbyxcbiAgICBtYWludGVuYW5jZV9mdW5kX2NvdmVyYWdlOiBpbnB1dC5tYWludGVuYW5jZV9mdW5kX2NvdmVyYWdlLFxuICAgIGdlbmVyYWxfbWVldGluZ19kZWNpc2lvbjogaW5wdXQuZ2VuZXJhbF9tZWV0aW5nX2RlY2lzaW9uLFxuICB9O1xuICBjb25zdCBzY29yaW5nUmVzdWx0ID0gc2NvcmVLWShzY29yaW5nSW5wdXQpO1xuXG4gIGNvbnN0IG92ZXJhbGxfcmVhZHkgPSAhY2hlY2tsaXN0LnNvbWUoKGMpID0+IGMuc3RhdHVzID09PSBcImJsb2NrZWRcIik7XG4gIGNvbnN0IG5leHRfc3RlcHMgPSBidWlsZE5leHRTdGVwcyhjaGVja2xpc3QpO1xuXG4gIHJldHVybiB7XG4gICAgb3ZlcmFsbF9yZWFkeSxcbiAgICBzY29yZTogc2NvcmluZ1Jlc3VsdC5zY29yZSxcbiAgICByaXNrX2xldmVsOiBzY29yaW5nUmVzdWx0LnJpc2tfbGV2ZWwsXG4gICAgY2hlY2tsaXN0LFxuICAgIG5leHRfc3RlcHMsXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgNDA1KTtcbiAgfVxuXG4gIGxldCBpbnB1dDogS1lSZWFkaW5lc3NJbnB1dDtcbiAgdHJ5IHtcbiAgICBpbnB1dCA9IChhd2FpdCByZXEuanNvbigpKSBhcyBLWVJlYWRpbmVzc0lucHV0O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiVmlnYW5lIEpTT04gc2lzZW5kXCIsIGRldGFpbDogU3RyaW5nKGVycikgfSwgNDAwKTtcbiAgfVxuXG4gIGNvbnN0IHJlcXVpcmVkID0gW1xuICAgIFwia3lfZGVidF9yYXRpb1wiLFxuICAgIFwibWFpbnRlbmFuY2VfZnVuZF9jb3ZlcmFnZVwiLFxuICAgIFwiZ2VuZXJhbF9tZWV0aW5nX2RlY2lzaW9uXCIsXG4gICAgXCJlbmVyZ3lfbGFiZWxcIixcbiAgICBcInRlY2huaWNhbF9jb25zdWx0YW50XCIsXG4gIF07XG4gIGNvbnN0IG1pc3NpbmcgPSByZXF1aXJlZC5maWx0ZXIoKGspID0+IChpbnB1dCBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrXSA9PT0gdW5kZWZpbmVkKTtcbiAgaWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogYFB1dWR1dmFkIHZcdTAwRTRsamFkOiAke21pc3Npbmcuam9pbihcIiwgXCIpfWAgfSwgNDAwKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gY2hlY2tLWVJlYWRpbmVzcyhpbnB1dCk7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZShyZXN1bHQsIDIwMCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJWYWxtaXNvbGVrdSBrb250cm9sbCBlYmFcdTAwRjVubmVzdHVzXCIsIGRldGFpbDogU3RyaW5nKGVycikgfSwgNTAwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBqc29uUmVzcG9uc2UoYm9keTogdW5rbm93biwgc3RhdHVzOiBudW1iZXIpOiBSZXNwb25zZSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICB9KTtcbn1cbiIsICIvLyBTYW1tIDQ6IFNrb29yaW1vb3RvcmkgcmVlZ2xpdGUgdGFiZWxcbi8vIERldGVybWluaXN0bGlrLCBrYWFsdXR1ZCBwdW5rdGlzXHUwMEZDc3RlZW0uIEtha3MgZXJhbGRpIHRhYmVsaXQ6IFZLRSBqYSBLXHUwMERDLlxuLy8gU2tvb3JpbW9vdG9yIChTYW1tIDUpIHJha2VuZGFiIG5laWQgcmVlZ2xlaWQgamEgYXJ2dXRhYiBrb29uZHNrb29yaSAwLTEwMC5cbi8vXG4vLyBOdW1icmlsaXNlZCByZWVnbGlkIGthc3V0YXZhZCBbbWluLCBtYXgpIHBvb2xhdmF0dWQgaW50ZXJ2YWxsZSwgdi5hIGp1aHVsXG4vLyBrdWkgbWluID09PSBtYXgsIG1pcyB0XHUwMEU0aGlzdGFiIHRcdTAwRTRwc2V0IHZcdTAwRTRcdTAwRTRydHVzdCAobnQgXCJtYWtzdXZcdTAwRjVsZyA9IDBcIikuXG4vLyBTZWUgdlx1MDBFNGxkaWIgbmloa2VpZCBwaWlydlx1MDBFNFx1MDBFNHJ0dXN0ZWwgKG50IHZcdTAwRTRcdTAwRTRydHVzIDAgZWkgdG9oaSBzYXR0dWRhIHZhaGVtaWtrdSBcIjwgMTAwMFwiKS5cblxuZXhwb3J0IHR5cGUgU2NvcmVCYW5kID0ge1xuICBsYWJlbDogc3RyaW5nO1xuICBwb2ludHM6IG51bWJlcjtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgTnVtZXJpY0ludGVydmFsQmFuZCBleHRlbmRzIFNjb3JlQmFuZCB7XG4gIG1pbjogbnVtYmVyOyAvLyBpbmtsdXNpaXZuZSAodi5hIHZcdTAwRjVyZHVzYmFuZCwga3VzIG1pbiA9PT0gbWF4KVxuICBtYXg6IG51bWJlcjsgLy8gZWtza2x1c2lpdm5lICh2LmEgdlx1MDBGNXJkdXNiYW5kKVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE51bWVyaWNSdWxlIHtcbiAgaWQ6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgdHlwZTogXCJudW1lcmljX2ludGVydmFsXCI7XG4gIHdlaWdodDogbnVtYmVyOyAvLyBtYXggcHVua3RpZCBzZWxsZSByZWVnbGkgZWVzdFxuICB1bml0OiBzdHJpbmc7XG4gIGJhbmRzOiBOdW1lcmljSW50ZXJ2YWxCYW5kW107IC8vIGpcdTAwRTRyamVzdHVzIG9sdWxpbmU6IHZcdTAwRjVyZHVzYmFuZGlkIGVubmUgdmFoZW1pa3ViYW5kZVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3JpY2FsQmFuZCBleHRlbmRzIFNjb3JlQmFuZCB7XG4gIGtleTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3JpY2FsUnVsZSB7XG4gIGlkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHR5cGU6IFwiY2F0ZWdvcmljYWxcIjtcbiAgd2VpZ2h0OiBudW1iZXI7XG4gIGJhbmRzOiBDYXRlZ29yaWNhbEJhbmRbXTtcbn1cblxuZXhwb3J0IHR5cGUgU2NvcmluZ1J1bGUgPSBOdW1lcmljUnVsZSB8IENhdGVnb3JpY2FsUnVsZTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBWS0UgcmVlZ2xpdGUgdGFiZWwgKGtva2t1IDEwMCBwdW5rdGkpXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGNvbnN0IFZLRV9TQ09SSU5HX1JVTEVTOiBTY29yaW5nUnVsZVtdID0gW1xuICB7XG4gICAgaWQ6IFwiZHNjclwiLFxuICAgIGxhYmVsOiBcIkRTQ1IgKERlYnQgU2VydmljZSBDb3ZlcmFnZSBSYXRpbylcIixcbiAgICB0eXBlOiBcIm51bWVyaWNfaW50ZXJ2YWxcIixcbiAgICB3ZWlnaHQ6IDI1LFxuICAgIHVuaXQ6IFwicmF0aW9cIixcbiAgICBiYW5kczogW1xuICAgICAgeyBtaW46IDEuNiwgbWF4OiBJbmZpbml0eSwgcG9pbnRzOiAyNSwgbGFiZWw6IFwiPj0gMS42XCIgfSxcbiAgICAgIHsgbWluOiAxLjQsIG1heDogMS42LCBwb2ludHM6IDE4LCBsYWJlbDogXCIxLjQgLSAxLjZcIiB9LFxuICAgICAgeyBtaW46IDEuMiwgbWF4OiAxLjQsIHBvaW50czogMTAsIGxhYmVsOiBcIjEuMiAtIDEuNFwiIH0sXG4gICAgICB7IG1pbjogLUluZmluaXR5LCBtYXg6IDEuMiwgcG9pbnRzOiAwLCBsYWJlbDogXCI8IDEuMlwiIH0sXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIGlkOiBcInJldmVudWVfc3RhYmlsaXR5XCIsXG4gICAgbGFiZWw6IFwiS1x1MDBFNGliZSBzdGFiaWlsc3VzICh2YXJpYXRzaW9vbmlrb3JkYWphIENWICsgdHJlbmQpXCIsXG4gICAgdHlwZTogXCJjYXRlZ29yaWNhbFwiLFxuICAgIHdlaWdodDogMTUsXG4gICAgYmFuZHM6IFtcbiAgICAgIHsga2V5OiBcImN2X2xvd190cmVuZF91cFwiLCBwb2ludHM6IDE1LCBsYWJlbDogXCJDViA8IDAuMTUsIHBvc2l0aWl2bmUgdHJlbmRcIiB9LFxuICAgICAgeyBrZXk6IFwiY3ZfbG93X3RyZW5kX2ZsYXRcIiwgcG9pbnRzOiAxMCwgbGFiZWw6IFwiQ1YgPCAwLjE1LCBzdGFiaWlsbmUvbGFuZ2V2IHRyZW5kLCBWXHUwMEQ1SSBDViAwLjE1LTAuMzAgcG9zaXRpaXZuZVwiIH0sXG4gICAgICB7IGtleTogXCJjdl9taWRfdHJlbmRfZmxhdFwiLCBwb2ludHM6IDUsIGxhYmVsOiBcIkNWIDAuMTUtMC4zMCBzdGFiaWlsbmUvbGFuZ2V2LCBWXHUwMEQ1SSBDViA+IDAuMzAgcG9zaXRpaXZuZVwiIH0sXG4gICAgICB7IGtleTogXCJjdl9oaWdoX3RyZW5kX2Rvd25cIiwgcG9pbnRzOiAwLCBsYWJlbDogXCJDViA+IDAuMzAsIGxhbmdldiB0cmVuZFwiIH0sXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIGlkOiBcImNvc3Rfc3RydWN0dXJlXCIsXG4gICAgbGFiZWw6IFwiS3VsdXN0cnVrdHV1ciAocFx1MDBGQ3Npa3VsdWRlIG9zYWthYWwga29ndWt1bHVkZXN0KVwiLFxuICAgIHR5cGU6IFwibnVtZXJpY19pbnRlcnZhbFwiLFxuICAgIHdlaWdodDogMTUsXG4gICAgdW5pdDogXCJyYXRpb1wiLFxuICAgIGJhbmRzOiBbXG4gICAgICB7IG1pbjogLUluZmluaXR5LCBtYXg6IDAuNCwgcG9pbnRzOiAxNSwgbGFiZWw6IFwiPCA0MCVcIiB9LFxuICAgICAgeyBtaW46IDAuNCwgbWF4OiAwLjYsIHBvaW50czogMTAsIGxhYmVsOiBcIjQwIC0gNjAlXCIgfSxcbiAgICAgIHsgbWluOiAwLjYsIG1heDogMC44LCBwb2ludHM6IDUsIGxhYmVsOiBcIjYwIC0gODAlXCIgfSxcbiAgICAgIHsgbWluOiAwLjgsIG1heDogSW5maW5pdHksIHBvaW50czogMCwgbGFiZWw6IFwiPj0gODAlXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwidGF4X2RlYnRcIixcbiAgICBsYWJlbDogXCJNYWtzdXZcdTAwRjVsZ1wiLFxuICAgIHR5cGU6IFwibnVtZXJpY19pbnRlcnZhbFwiLFxuICAgIHdlaWdodDogMTUsXG4gICAgdW5pdDogXCJFVVJcIixcbiAgICBiYW5kczogW1xuICAgICAgeyBtaW46IDAsIG1heDogMCwgcG9pbnRzOiAxNSwgbGFiZWw6IFwiMCBFVVJcIiB9LFxuICAgICAgeyBtaW46IDAsIG1heDogMTAwMCwgcG9pbnRzOiA4LCBsYWJlbDogXCIwIDwgeCA8IDEwMDAgRVVSXCIgfSxcbiAgICAgIHsgbWluOiAxMDAwLCBtYXg6IEluZmluaXR5LCBwb2ludHM6IDAsIGxhYmVsOiBcIj49IDEwMDAgRVVSXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwiY29tcGFueV9hZ2VcIixcbiAgICBsYWJlbDogXCJFdHRldlx1MDBGNXR0ZSB2YW51c1wiLFxuICAgIHR5cGU6IFwiY2F0ZWdvcmljYWxcIixcbiAgICB3ZWlnaHQ6IDE1LFxuICAgIGJhbmRzOiBbXG4gICAgICB7IGtleTogXCIzeV9wbHVzXCIsIHBvaW50czogMTUsIGxhYmVsOiBcIjMrIGFhc3RhdFwiIH0sXG4gICAgICB7IGtleTogXCIxeV8zeVwiLCBwb2ludHM6IDEwLCBsYWJlbDogXCIxLTMgYWFzdGF0XCIgfSxcbiAgICAgIHsga2V5OiBcIjZtXzEybVwiLCBwb2ludHM6IDUsIGxhYmVsOiBcIjYtMTIga3V1ZFwiIH0sXG4gICAgICB7IGtleTogXCIwbV82bVwiLCBwb2ludHM6IDAsIGxhYmVsOiBcIjAtNiBrdXVkXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwiYWNjb3VudGluZ19xdWFsaXR5XCIsXG4gICAgbGFiZWw6IFwiUmFhbWF0dXBpZGFtaXNlIGt2YWxpdGVldCAoalx1MDBFNHJqZXBpZGV2dXMsIHZpaXZpc2VkKVwiLFxuICAgIHR5cGU6IFwiY2F0ZWdvcmljYWxcIixcbiAgICB3ZWlnaHQ6IDE1LFxuICAgIGJhbmRzOiBbXG4gICAgICB7IGtleTogXCJjb25zaXN0ZW50X25vX2FycmVhcnNcIiwgcG9pbnRzOiAxNSwgbGFiZWw6IFwiSlx1MDBFNHJqZXBpZGV2LCB2aWl2aXN0ZXRhXCIgfSxcbiAgICAgIHsga2V5OiBcImNvbnNpc3RlbnRfbWlub3JfYXJyZWFyc1wiLCBwb2ludHM6IDEwLCBsYWJlbDogXCJKXHUwMEU0cmplcGlkZXYsIHZcdTAwRTRpa3NlZCB2aWl2aXNlZFwiIH0sXG4gICAgICB7IGtleTogXCJpbmNvbnNpc3RlbnRfbm9fYXJyZWFyc1wiLCBwb2ludHM6IDUsIGxhYmVsOiBcIkViYWpcdTAwRTRyamVwaWRldiwgdmlpdmlzdGV0YVwiIH0sXG4gICAgICB7IGtleTogXCJpbmNvbnNpc3RlbnRfd2l0aF9hcnJlYXJzXCIsIHBvaW50czogMCwgbGFiZWw6IFwiRWJhalx1MDBFNHJqZXBpZGV2LCB2aWl2aXN0ZWdhXCIgfSxcbiAgICBdLFxuICB9LFxuXTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBLXHUwMERDIHJlZWdsaXRlIHRhYmVsIChrb2trdSAxMDAgcHVua3RpKVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBjb25zdCBLWV9TQ09SSU5HX1JVTEVTOiBTY29yaW5nUnVsZVtdID0gW1xuICB7XG4gICAgaWQ6IFwia3lfZGVidF9yYXRpb1wiLFxuICAgIGxhYmVsOiBcIktcdTAwREMgbGlpa21ldGUgdlx1MDBGNWxnbmV2dXNlZCAoJSBtYWphbmR1c2t1bHVkZXN0KVwiLFxuICAgIHR5cGU6IFwibnVtZXJpY19pbnRlcnZhbFwiLFxuICAgIHdlaWdodDogMzAsXG4gICAgdW5pdDogXCJyYXRpb1wiLFxuICAgIGJhbmRzOiBbXG4gICAgICB7IG1pbjogLUluZmluaXR5LCBtYXg6IDAuMDUsIHBvaW50czogMzAsIGxhYmVsOiBcIjwgNSVcIiB9LFxuICAgICAgeyBtaW46IDAuMDUsIG1heDogMC4xLCBwb2ludHM6IDE1LCBsYWJlbDogXCI1IC0gMTAlXCIgfSxcbiAgICAgIHsgbWluOiAwLjEsIG1heDogSW5maW5pdHksIHBvaW50czogMCwgbGFiZWw6IFwiPj0gMTAlXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwibWFpbnRlbmFuY2VfZnVuZF9jb3ZlcmFnZVwiLFxuICAgIGxhYmVsOiBcIkhvb2xkdXNmb25kaSBrYXRlIChFVVIvbVx1MDBCMilcIixcbiAgICB0eXBlOiBcIm51bWVyaWNfaW50ZXJ2YWxcIixcbiAgICB3ZWlnaHQ6IDMwLFxuICAgIHVuaXQ6IFwiRVVSL20yXCIsXG4gICAgYmFuZHM6IFtcbiAgICAgIHsgbWluOiAxLjAsIG1heDogSW5maW5pdHksIHBvaW50czogMzAsIGxhYmVsOiBcIj49IDEuMCBFVVIvbVx1MDBCMlwiIH0sXG4gICAgICB7IG1pbjogMC41LCBtYXg6IDEuMCwgcG9pbnRzOiAxNSwgbGFiZWw6IFwiMC41IC0gMS4wIEVVUi9tXHUwMEIyXCIgfSxcbiAgICAgIHsgbWluOiAtSW5maW5pdHksIG1heDogMC41LCBwb2ludHM6IDAsIGxhYmVsOiBcIjwgMC41IEVVUi9tXHUwMEIyXCIgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IFwiZ2VuZXJhbF9tZWV0aW5nX2RlY2lzaW9uXCIsXG4gICAgbGFiZWw6IFwiXHUwMERDbGRrb29zb2xla3Ugb3RzdXMgbGFlbnUvaW52ZXN0ZWVyaW5ndSBrb2h0YVwiLFxuICAgIHR5cGU6IFwiY2F0ZWdvcmljYWxcIixcbiAgICB3ZWlnaHQ6IDQwLFxuICAgIGJhbmRzOiBbXG4gICAgICB7IGtleTogXCJ0d29fdGhpcmRzX21ham9yaXR5XCIsIHBvaW50czogNDAsIGxhYmVsOiBcIjIvMyBoXHUwMEU0XHUwMEU0bHRlZW5hbXVzXCIgfSxcbiAgICAgIHsga2V5OiBcInNpbXBsZV9tYWpvcml0eVwiLCBwb2ludHM6IDIwLCBsYWJlbDogXCI1MCUgKGxpaHRoXHUwMEU0XHUwMEU0bHRlZW5hbXVzKVwiIH0sXG4gICAgICB7IGtleTogXCJtaXNzaW5nXCIsIHBvaW50czogMCwgbGFiZWw6IFwiT3RzdXMgcHV1ZHViXCIgfSxcbiAgICBdLFxuICB9LFxuXTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBMb29rdXAtYWJpZnVua3RzaW9vbmlkIHRhYmVsaSBrYXN1dGFtaXNla3MgKFNhbW0gNSByYWtlbmRhYiBuZWlkKVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaE51bWVyaWNCYW5kKHJ1bGU6IE51bWVyaWNSdWxlLCB2YWx1ZTogbnVtYmVyKTogTnVtZXJpY0ludGVydmFsQmFuZCB7XG4gIGZvciAoY29uc3QgYmFuZCBvZiBydWxlLmJhbmRzKSB7XG4gICAgaWYgKGJhbmQubWluID09PSBiYW5kLm1heCkge1xuICAgICAgaWYgKHZhbHVlID09PSBiYW5kLm1pbikgcmV0dXJuIGJhbmQ7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA+PSBiYW5kLm1pbiAmJiB2YWx1ZSA8IGJhbmQubWF4KSB7XG4gICAgICByZXR1cm4gYmFuZDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJ1bGUuYmFuZHNbcnVsZS5iYW5kcy5sZW5ndGggLSAxXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoQ2F0ZWdvcmljYWxCYW5kKFxuICBydWxlOiBDYXRlZ29yaWNhbFJ1bGUsXG4gIGtleTogc3RyaW5nLFxuKTogQ2F0ZWdvcmljYWxCYW5kIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHJ1bGUuYmFuZHMuZmluZCgoYikgPT4gYi5rZXkgPT09IGtleSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b3RhbFdlaWdodChydWxlczogU2NvcmluZ1J1bGVbXSk6IG51bWJlciB7XG4gIHJldHVybiBydWxlcy5yZWR1Y2UoKHN1bSwgcikgPT4gc3VtICsgci53ZWlnaHQsIDApO1xufVxuIiwgIi8vIFNhbW0gNTogU2tvb3JpbW9vdG9yXG4vLyBSYWtlbmRhYiBTYW1tdSA0IHJlZWdsaXRhYmVsaXQgc2lzZW5kdlx1MDBFNFx1MDBFNHJ0dXN0ZWxlIGphIGFydnV0YWI6XG4vLyAtIGtvb25kc2tvb3IgKDAtMTAwKVxuLy8gLSByaXNraXRhc2Vcbi8vIC0gdHVnZXZ1c2VkIChiYW5kaWQsIGt1cyBzYWF2dXRhdGkgPj04MCUgbWF4IHB1bmt0aWRlc3QpXG4vLyAtIG5cdTAwRjVya3VzZWQgKGJhbmRpZCwga3VzIHNhYXZ1dGF0aSA8PTMwJSBtYXggcHVua3RpZGVzdClcblxuaW1wb3J0IHtcbiAgVktFX1NDT1JJTkdfUlVMRVMsXG4gIEtZX1NDT1JJTkdfUlVMRVMsXG4gIG1hdGNoTnVtZXJpY0JhbmQsXG4gIG1hdGNoQ2F0ZWdvcmljYWxCYW5kLFxuICB0eXBlIFNjb3JpbmdSdWxlLFxufSBmcm9tIFwiLi9ydWxlc1wiO1xuXG5leHBvcnQgdHlwZSBTY29yaW5nSW5wdXQgPSBSZWNvcmQ8c3RyaW5nLCBudW1iZXIgfCBzdHJpbmc+O1xuXG5leHBvcnQgaW50ZXJmYWNlIFJ1bGVCcmVha2Rvd24ge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xuICB3ZWlnaHQ6IG51bWJlcjtcbiAgcG9pbnRzOiBudW1iZXI7XG4gIGJhbmRMYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBSaXNrTGV2ZWwgPSBcIm1hZGFsXCIgfCBcImtlc2ttaW5lXCIgfCBcImtcdTAwRjVyZ2VcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTY29yaW5nUmVzdWx0IHtcbiAgc2NvcmU6IG51bWJlcjsgLy8gMC0xMDBcbiAgcmlza19sZXZlbDogUmlza0xldmVsO1xuICBzdHJlbmd0aHM6IHN0cmluZ1tdO1xuICB3ZWFrbmVzc2VzOiBzdHJpbmdbXTtcbiAgYnJlYWtkb3duOiBSdWxlQnJlYWtkb3duW107XG59XG5cbi8vIFJpc2tpdGFzZW1lIGxcdTAwRTR2ZW5kaWQuIEFuZG1lZCBwdXVkdXZhZCB2YWxka29ubmFla3NwZXJkaSB2YWxpZGVlcmluZ3Uga29odGEgXHUyMDE0XG4vLyBuZWVkIG9uIGVzaWFsZ3NlZCBtXHUwMEY1aXN0bGlrdWQgdlx1MDBFNFx1MDBFNHJ0dXNlZCwgbWlzIHZhamF2YWQgXHUwMEZDbGV2YWF0dXN0IGVubmUgbGl2ZSBrYXN1dHVzdC5cbmNvbnN0IFJJU0tfVEhSRVNIT0xEUyA9IHtcbiAgbWFkYWw6IDcwLCAvLyBzY29yZSA+PSA3MFxuICBrZXNrbWluZTogNDAsIC8vIDQwIDw9IHNjb3JlIDwgNzBcbiAgLy8gc2NvcmUgPCA0MCA9PiBrXHUwMEY1cmdlXG59O1xuXG5jb25zdCBTVFJFTkdUSF9SQVRJTyA9IDAuODsgLy8gPj04MCUgbWF4IHB1bmt0aWRlc3QgPSB0dWdldnVzXG5jb25zdCBXRUFLTkVTU19SQVRJTyA9IDAuMzsgLy8gPD0zMCUgbWF4IHB1bmt0aWRlc3QgPSBuXHUwMEY1cmt1c1xuXG5mdW5jdGlvbiBjb21wdXRlU2NvcmUocnVsZXM6IFNjb3JpbmdSdWxlW10sIGlucHV0OiBTY29yaW5nSW5wdXQpOiBTY29yaW5nUmVzdWx0IHtcbiAgY29uc3QgYnJlYWtkb3duOiBSdWxlQnJlYWtkb3duW10gPSBbXTtcbiAgY29uc3QgbWlzc2luZzogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgaW52YWxpZDogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHJ1bGUgb2YgcnVsZXMpIHtcbiAgICBjb25zdCByYXdWYWx1ZSA9IGlucHV0W3J1bGUuaWRdO1xuXG4gICAgaWYgKHJhd1ZhbHVlID09PSB1bmRlZmluZWQgfHwgcmF3VmFsdWUgPT09IG51bGwpIHtcbiAgICAgIG1pc3NpbmcucHVzaChydWxlLmlkKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChydWxlLnR5cGUgPT09IFwibnVtZXJpY19pbnRlcnZhbFwiKSB7XG4gICAgICBpZiAodHlwZW9mIHJhd1ZhbHVlICE9PSBcIm51bWJlclwiIHx8IE51bWJlci5pc05hTihyYXdWYWx1ZSkpIHtcbiAgICAgICAgaW52YWxpZC5wdXNoKGAke3J1bGUuaWR9OiBvb2RhdGkgbnVtYnJpdCwgc2FhZGkgXCIke3Jhd1ZhbHVlfVwiYCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgYmFuZCA9IG1hdGNoTnVtZXJpY0JhbmQocnVsZSwgcmF3VmFsdWUpO1xuICAgICAgYnJlYWtkb3duLnB1c2goe1xuICAgICAgICBpZDogcnVsZS5pZCxcbiAgICAgICAgbGFiZWw6IHJ1bGUubGFiZWwsXG4gICAgICAgIHdlaWdodDogcnVsZS53ZWlnaHQsXG4gICAgICAgIHBvaW50czogYmFuZC5wb2ludHMsXG4gICAgICAgIGJhbmRMYWJlbDogYmFuZC5sYWJlbCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHJhd1ZhbHVlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGludmFsaWQucHVzaChgJHtydWxlLmlkfTogb29kYXRpIHN0cmluZ2kgKGthdGVnb29yaWEgdlx1MDBGNXRpKSwgc2FhZGkgXCIke3Jhd1ZhbHVlfVwiYCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgYmFuZCA9IG1hdGNoQ2F0ZWdvcmljYWxCYW5kKHJ1bGUsIHJhd1ZhbHVlKTtcbiAgICAgIGlmICghYmFuZCkge1xuICAgICAgICBjb25zdCB2YWxpZEtleXMgPSBydWxlLmJhbmRzLm1hcCgoYikgPT4gYi5rZXkpLmpvaW4oXCIsIFwiKTtcbiAgICAgICAgaW52YWxpZC5wdXNoKGAke3J1bGUuaWR9OiB0dW5kbWF0dSBrYXRlZ29vcmlhIFwiJHtyYXdWYWx1ZX1cIiAobHViYXR1ZDogJHt2YWxpZEtleXN9KWApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrZG93bi5wdXNoKHtcbiAgICAgICAgaWQ6IHJ1bGUuaWQsXG4gICAgICAgIGxhYmVsOiBydWxlLmxhYmVsLFxuICAgICAgICB3ZWlnaHQ6IHJ1bGUud2VpZ2h0LFxuICAgICAgICBwb2ludHM6IGJhbmQucG9pbnRzLFxuICAgICAgICBiYW5kTGFiZWw6IGJhbmQubGFiZWwsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBpZiAobWlzc2luZy5sZW5ndGggPiAwIHx8IGludmFsaWQubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChtaXNzaW5nLmxlbmd0aCA+IDApIHBhcnRzLnB1c2goYFB1dWR1dmFkIHZcdTAwRTRsamFkOiAke21pc3Npbmcuam9pbihcIiwgXCIpfWApO1xuICAgIGlmIChpbnZhbGlkLmxlbmd0aCA+IDApIHBhcnRzLnB1c2goYFZpZ2FzZWQgdlx1MDBFNFx1MDBFNHJ0dXNlZDogJHtpbnZhbGlkLmpvaW4oXCI7IFwiKX1gKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IocGFydHMuam9pbihcIiB8IFwiKSk7XG4gIH1cblxuICBjb25zdCBzY29yZSA9IGJyZWFrZG93bi5yZWR1Y2UoKHN1bSwgYikgPT4gc3VtICsgYi5wb2ludHMsIDApO1xuXG4gIGNvbnN0IHJpc2tfbGV2ZWw6IFJpc2tMZXZlbCA9XG4gICAgc2NvcmUgPj0gUklTS19USFJFU0hPTERTLm1hZGFsXG4gICAgICA/IFwibWFkYWxcIlxuICAgICAgOiBzY29yZSA+PSBSSVNLX1RIUkVTSE9MRFMua2Vza21pbmVcbiAgICAgICAgPyBcImtlc2ttaW5lXCJcbiAgICAgICAgOiBcImtcdTAwRjVyZ2VcIjtcblxuICBjb25zdCBzdHJlbmd0aHMgPSBicmVha2Rvd25cbiAgICAuZmlsdGVyKChiKSA9PiBiLndlaWdodCA+IDAgJiYgYi5wb2ludHMgLyBiLndlaWdodCA+PSBTVFJFTkdUSF9SQVRJTylcbiAgICAubWFwKChiKSA9PiBgJHtiLmxhYmVsfTogJHtiLmJhbmRMYWJlbH1gKTtcblxuICBjb25zdCB3ZWFrbmVzc2VzID0gYnJlYWtkb3duXG4gICAgLmZpbHRlcigoYikgPT4gYi53ZWlnaHQgPiAwICYmIGIucG9pbnRzIC8gYi53ZWlnaHQgPD0gV0VBS05FU1NfUkFUSU8pXG4gICAgLm1hcCgoYikgPT4gYCR7Yi5sYWJlbH06ICR7Yi5iYW5kTGFiZWx9YCk7XG5cbiAgcmV0dXJuIHsgc2NvcmUsIHJpc2tfbGV2ZWwsIHN0cmVuZ3Rocywgd2Vha25lc3NlcywgYnJlYWtkb3duIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzY29yZVZLRShpbnB1dDogU2NvcmluZ0lucHV0KTogU2NvcmluZ1Jlc3VsdCB7XG4gIHJldHVybiBjb21wdXRlU2NvcmUoVktFX1NDT1JJTkdfUlVMRVMsIGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNjb3JlS1koaW5wdXQ6IFNjb3JpbmdJbnB1dCk6IFNjb3JpbmdSZXN1bHQge1xuICByZXR1cm4gY29tcHV0ZVNjb3JlKEtZX1NDT1JJTkdfUlVMRVMsIGlucHV0KTtcbn1cblxuZXhwb3J0ICogZnJvbSBcIi4vcnVsZXNcIjtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFB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
