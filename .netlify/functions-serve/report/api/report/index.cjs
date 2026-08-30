"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/report/index.ts
var index_exports = {};
__export(index_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(index_exports);

// lib/reporting/index.ts
var import_sdk = __toESM(require("@anthropic-ai/sdk"));
var REPORT_SYSTEM_PROMPT = `Sa oled P.E.E.T.E.R. \u2014 Finantsdisain AI finants- ja \xE4ristrateegia anal\xFC\xFCtik.
Sinu \xFClesanne on kirjutada \xFCks raporti sektsioon, l\xE4htudes sulle antud struktureeritud andmetest.

Reeglid:
- Kirjuta eesti keeles, professionaalses, otsekoheses toonis. Ei liigset entusiasmi, ei ebam\xE4\xE4rasust.
- Kasuta AINULT sulle antud andmeid. \xC4ra leiuta fakte, numbreid ega soovitusi, mida andmetes pole.
- Pikkus: 3-6 lauset, v.a kui juhend \xFCtleb teisiti.
- \xC4ra korda pealkirja tekstis.
- Vasta AINULT raporti sektsiooni tekstiga, ilma preambulita, ilma markdown-pealkirjadeta.`;
async function generateSection(anthropic, sectionName, instructions, data) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: REPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Sektsioon: ${sectionName}

Juhend: ${instructions}

Andmed:
${JSON.stringify(data, null, 2)}`
      }
    ]
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Claude API ei tagastanud teksti sektsiooni "${sectionName}" jaoks`);
  }
  return textBlock.text.trim();
}
async function generateReport(input, apiKey, client) {
  const anthropic = client ?? new import_sdk.default({ apiKey });
  const { profile, scoringResult, actionPlan, kyReadiness, matchedGrants } = input;
  const [finantsprofiilText, skooridText, riskidText, voimalusedText, tegevuskavaText, toetusedText, kyText] = await Promise.all([
    generateSection(
      anthropic,
      "Finantsprofiil",
      "Kirjelda l\xFChidalt anal\xFC\xFCsitud \xFCksust ja perioodi.",
      profile
    ),
    generateSection(
      anthropic,
      "Skoorid",
      "Selgita koondskoori ja riskitaset kriteeriumite l\xF5ikes.",
      { score: scoringResult.score, risk_level: scoringResult.risk_level, breakdown: scoringResult.breakdown }
    ),
    generateSection(
      anthropic,
      "Riskid",
      "Too v\xE4lja peamised n\xF5rkused ja riskid.",
      { weaknesses: scoringResult.weaknesses, risk_level: scoringResult.risk_level }
    ),
    generateSection(
      anthropic,
      "V\xF5imalused",
      "Too v\xE4lja tugevused ja positiivsed signaalid.",
      { strengths: scoringResult.strengths }
    ),
    generateSection(
      anthropic,
      "Tegevuskava",
      actionPlan ? "Kokkuv\xF5ta soovitatud tegevused prioriteedi j\xE4rgi." : "Tegevuskava ei ole selle segmendi jaoks genereeritud (K\xDC segment kasutab valmisoleku sammusid).",
      actionPlan ?? kyReadiness?.next_steps ?? []
    ),
    generateSection(
      anthropic,
      "Toetused",
      matchedGrants.length > 0 ? "Tutvusta sobivaid toetusprogramme." : "\xDChtegi sobivat toetusprogrammi ei leitud praeguste kriteeriumite alusel.",
      matchedGrants
    ),
    profile.segment === "ky" && kyReadiness ? generateSection(
      anthropic,
      "K\xDC valmisolek",
      "Kokkuv\xF5ta valmisoleku staatus ja j\xE4rgmised sammud KredEx/EIS taotluseni.",
      kyReadiness
    ) : Promise.resolve("")
  ]);
  return {
    generated_at: (/* @__PURE__ */ new Date()).toISOString(),
    profile,
    sections: {
      finantsprofiil: { heading: "Finantsprofiil", narrative: finantsprofiilText },
      skoorid: { heading: "Skoorid", narrative: skooridText },
      riskid: { heading: "Riskid", narrative: riskidText },
      voimalused: { heading: "V\xF5imalused", narrative: voimalusedText },
      tegevuskava: { heading: "Tegevuskava", narrative: tegevuskavaText },
      toetused: { heading: "Toetused", narrative: toetusedText },
      ky_valmisolek: profile.segment === "ky" && kyReadiness ? { heading: "K\xDC valmisolek", narrative: kyText } : null
    },
    raw_data: {
      score: scoringResult.score,
      risk_level: scoringResult.risk_level,
      breakdown: scoringResult.breakdown,
      action_plan: actionPlan ?? null,
      matched_grants: matchedGrants,
      ky_readiness: kyReadiness ?? null
    }
  };
}

// api/report/index.ts
var config = {
  path: "/api/report"
};
async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Server misconfiguration: ANTHROPIC_API_KEY puudub" }, 500);
  }
  let input;
  try {
    input = await req.json();
  } catch (err) {
    return jsonResponse({ error: "Vigane JSON sisend", detail: String(err) }, 400);
  }
  if (!input.profile || !input.scoringResult || !Array.isArray(input.matchedGrants)) {
    return jsonResponse(
      { error: "Sisend peab sisaldama 'profile', 'scoringResult' ja 'matchedGrants' v\xE4ljasid" },
      400
    );
  }
  try {
    const report = await generateReport(input, apiKey);
    return jsonResponse(report, 200);
  } catch (err) {
    return jsonResponse({ error: "Raporti genereerimine eba\xF5nnestus", detail: String(err) }, 502);
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
  config
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpL3JlcG9ydC9pbmRleC50cyIsICJsaWIvcmVwb3J0aW5nL2luZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBOZXRsaWZ5IEZ1bmN0aW9uICh2MiwgV2ViIEFQSSBoYW5kbGVyKVxuLy8gU2FtbSAxMDogUmFwb3J0aWdlbmVyYWF0b3JpIGVuZHBvaW50XG4vLyBTaXNlbmQ6IFJlcG9ydElucHV0IChwcm9maWxlLCBzY29yaW5nUmVzdWx0LCBhY3Rpb25QbGFuPywga3lSZWFkaW5lc3M/LCBtYXRjaGVkR3JhbnRzKVxuLy8gVlx1MDBFNGxqdW5kOiBSZXBvcnQgKG5hcnJhdGlpdnNlZCBzZWt0c2lvb25pZCArIHJhd19kYXRhKVxuXG5pbXBvcnQgeyBnZW5lcmF0ZVJlcG9ydCwgdHlwZSBSZXBvcnRJbnB1dCB9IGZyb20gXCIuLi8uLi9saWIvcmVwb3J0aW5nXCI7XG5cbmV4cG9ydCBjb25zdCBjb25maWcgPSB7XG4gIHBhdGg6IFwiL2FwaS9yZXBvcnRcIixcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgNDA1KTtcbiAgfVxuXG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJTZXJ2ZXIgbWlzY29uZmlndXJhdGlvbjogQU5USFJPUElDX0FQSV9LRVkgcHV1ZHViXCIgfSwgNTAwKTtcbiAgfVxuXG4gIGxldCBpbnB1dDogUmVwb3J0SW5wdXQ7XG4gIHRyeSB7XG4gICAgaW5wdXQgPSAoYXdhaXQgcmVxLmpzb24oKSkgYXMgUmVwb3J0SW5wdXQ7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJWaWdhbmUgSlNPTiBzaXNlbmRcIiwgZGV0YWlsOiBTdHJpbmcoZXJyKSB9LCA0MDApO1xuICB9XG5cbiAgaWYgKCFpbnB1dC5wcm9maWxlIHx8ICFpbnB1dC5zY29yaW5nUmVzdWx0IHx8ICFBcnJheS5pc0FycmF5KGlucHV0Lm1hdGNoZWRHcmFudHMpKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgIHsgZXJyb3I6IFwiU2lzZW5kIHBlYWIgc2lzYWxkYW1hICdwcm9maWxlJywgJ3Njb3JpbmdSZXN1bHQnIGphICdtYXRjaGVkR3JhbnRzJyB2XHUwMEU0bGphc2lkXCIgfSxcbiAgICAgIDQwMCxcbiAgICApO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXBvcnQgPSBhd2FpdCBnZW5lcmF0ZVJlcG9ydChpbnB1dCwgYXBpS2V5KTtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHJlcG9ydCwgMjAwKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIlJhcG9ydGkgZ2VuZXJlZXJpbWluZSBlYmFcdTAwRjVubmVzdHVzXCIsIGRldGFpbDogU3RyaW5nKGVycikgfSwgNTAyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBqc29uUmVzcG9uc2UoYm9keTogdW5rbm93biwgc3RhdHVzOiBudW1iZXIpOiBSZXNwb25zZSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICB9KTtcbn1cbiIsICIvLyBTYW1tIDEwOiBSYXBvcnRpZ2VuZXJhYXRvclxuLy8gS29tYmluZWVyaWIgU2FtbXVkZSA1LTkgdlx1MDBFNGxqdW5kaWQgXHUwMEZDaGVrcyBwcm9mZXNzaW9uYWFsc2VrcyByYXBvcnRpa3M6XG4vLyBmaW5hbnRzcHJvZmlpbCwgc2tvb3JpZCwgcmlza2lkLCB2XHUwMEY1aW1hbHVzZWQsIHRlZ2V2dXNrYXZhLCB0b2V0dXNlZCwgS1x1MDBEQyB2YWxtaXNvbGVrIChrdWkga29oYWxkdWIpXG5cbmltcG9ydCBBbnRocm9waWMgZnJvbSBcIkBhbnRocm9waWMtYWkvc2RrXCI7XG5pbXBvcnQgdHlwZSB7IFNjb3JpbmdSZXN1bHQgfSBmcm9tIFwiLi4vc2NvcmluZ1wiO1xuaW1wb3J0IHR5cGUgeyBBY3Rpb25JdGVtIH0gZnJvbSBcIi4uL29wcG9ydHVuaXRpZXNcIjtcblxuZXhwb3J0IHR5cGUgUmVwb3J0U2VnbWVudCA9IFwidmtlXCIgfCBcImt5XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmluYW5jaWFsUHJvZmlsZSB7XG4gIGVudGl0eV9uYW1lOiBzdHJpbmc7XG4gIHNlZ21lbnQ6IFJlcG9ydFNlZ21lbnQ7XG4gIC8vIFZLRS1zcGV0c2lpZmlsaW5lXG4gIGVtdGFrX2NvZGU/OiBzdHJpbmc7XG4gIGNvbXBhbnlfYWdlX3llYXJzPzogbnVtYmVyO1xuICAvLyBLXHUwMERDLXNwZXRzaWlmaWxpbmVcbiAgYWRkcmVzcz86IHN0cmluZztcbiAgdW5pdF9jb3VudD86IG51bWJlcjtcbiAgLy8gXHUwMERDaGluZVxuICBwZXJpb2RfYW5hbHl6ZWQ6IHN0cmluZzsgLy8gbnQgXCIyMDI1LTA4IC0gMjAyNi0wN1wiXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWF0Y2hlZEdyYW50IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwcm92aWRlcjogc3RyaW5nO1xuICBtYXhfYW1vdW50X2V1cjogbnVtYmVyIHwgbnVsbDtcbiAgZnVuZGluZ19yYXRlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS1lSZWFkaW5lc3NTdW1tYXJ5IHtcbiAgb3ZlcmFsbF9yZWFkeTogYm9vbGVhbjtcbiAgY2hlY2tsaXN0X3N1bW1hcnk6IHN0cmluZzsgLy8gbFx1MDBGQ2hpa29ra3V2XHUwMEY1dGUgY2hlY2tsaXN0IHN0YWF0dXN0ZXN0XG4gIG5leHRfc3RlcHM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlcG9ydElucHV0IHtcbiAgcHJvZmlsZTogRmluYW5jaWFsUHJvZmlsZTtcbiAgc2NvcmluZ1Jlc3VsdDogU2NvcmluZ1Jlc3VsdDtcbiAgYWN0aW9uUGxhbj86IEFjdGlvbkl0ZW1bXTsgLy8gVktFIHNlZ21lbnRcbiAga3lSZWFkaW5lc3M/OiBLWVJlYWRpbmVzc1N1bW1hcnk7IC8vIEtZIHNlZ21lbnRcbiAgbWF0Y2hlZEdyYW50czogTWF0Y2hlZEdyYW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVwb3J0U2VjdGlvbiB7XG4gIGhlYWRpbmc6IHN0cmluZztcbiAgbmFycmF0aXZlOiBzdHJpbmc7IC8vIENsYXVkZSBBUEkgZ2VuZXJlZXJpdHVkIHByb3NhXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVwb3J0IHtcbiAgZ2VuZXJhdGVkX2F0OiBzdHJpbmc7IC8vIElTTyA4NjAxXG4gIHByb2ZpbGU6IEZpbmFuY2lhbFByb2ZpbGU7XG4gIHNlY3Rpb25zOiB7XG4gICAgZmluYW50c3Byb2ZpaWw6IFJlcG9ydFNlY3Rpb247XG4gICAgc2tvb3JpZDogUmVwb3J0U2VjdGlvbjtcbiAgICByaXNraWQ6IFJlcG9ydFNlY3Rpb247XG4gICAgdm9pbWFsdXNlZDogUmVwb3J0U2VjdGlvbjtcbiAgICB0ZWdldnVza2F2YTogUmVwb3J0U2VjdGlvbjtcbiAgICB0b2V0dXNlZDogUmVwb3J0U2VjdGlvbjtcbiAgICBreV92YWxtaXNvbGVrOiBSZXBvcnRTZWN0aW9uIHwgbnVsbDsgLy8gYWludWx0IEtZIHNlZ21lbnRcbiAgfTtcbiAgcmF3X2RhdGE6IHtcbiAgICBzY29yZTogbnVtYmVyO1xuICAgIHJpc2tfbGV2ZWw6IHN0cmluZztcbiAgICBicmVha2Rvd246IFNjb3JpbmdSZXN1bHRbXCJicmVha2Rvd25cIl07XG4gICAgYWN0aW9uX3BsYW46IEFjdGlvbkl0ZW1bXSB8IG51bGw7XG4gICAgbWF0Y2hlZF9ncmFudHM6IE1hdGNoZWRHcmFudFtdO1xuICAgIGt5X3JlYWRpbmVzczogS1lSZWFkaW5lc3NTdW1tYXJ5IHwgbnVsbDtcbiAgfTtcbn1cblxuY29uc3QgUkVQT1JUX1NZU1RFTV9QUk9NUFQgPSBgU2Egb2xlZCBQLkUuRS5ULkUuUi4gXHUyMDE0IEZpbmFudHNkaXNhaW4gQUkgZmluYW50cy0gamEgXHUwMEU0cmlzdHJhdGVlZ2lhIGFuYWxcdTAwRkNcdTAwRkN0aWsuXG5TaW51IFx1MDBGQ2xlc2FubmUgb24ga2lyanV0YWRhIFx1MDBGQ2tzIHJhcG9ydGkgc2VrdHNpb29uLCBsXHUwMEU0aHR1ZGVzIHN1bGxlIGFudHVkIHN0cnVrdHVyZWVyaXR1ZCBhbmRtZXRlc3QuXG5cblJlZWdsaWQ6XG4tIEtpcmp1dGEgZWVzdGkga2VlbGVzLCBwcm9mZXNzaW9uYWFsc2VzLCBvdHNla29oZXNlcyB0b29uaXMuIEVpIGxpaWdzZXQgZW50dXNpYXNtaSwgZWkgZWJhbVx1MDBFNFx1MDBFNHJhc3VzdC5cbi0gS2FzdXRhIEFJTlVMVCBzdWxsZSBhbnR1ZCBhbmRtZWlkLiBcdTAwQzRyYSBsZWl1dGEgZmFrdGUsIG51bWJyZWlkIGVnYSBzb292aXR1c2ksIG1pZGEgYW5kbWV0ZXMgcG9sZS5cbi0gUGlra3VzOiAzLTYgbGF1c2V0LCB2LmEga3VpIGp1aGVuZCBcdTAwRkN0bGViIHRlaXNpdGkuXG4tIFx1MDBDNHJhIGtvcmRhIHBlYWxraXJqYSB0ZWtzdGlzLlxuLSBWYXN0YSBBSU5VTFQgcmFwb3J0aSBzZWt0c2lvb25pIHRla3N0aWdhLCBpbG1hIHByZWFtYnVsaXRhLCBpbG1hIG1hcmtkb3duLXBlYWxraXJqYWRldGEuYDtcblxuYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVTZWN0aW9uKFxuICBhbnRocm9waWM6IEFudGhyb3BpYyxcbiAgc2VjdGlvbk5hbWU6IHN0cmluZyxcbiAgaW5zdHJ1Y3Rpb25zOiBzdHJpbmcsXG4gIGRhdGE6IHVua25vd24sXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBtZXNzYWdlID0gYXdhaXQgYW50aHJvcGljLm1lc3NhZ2VzLmNyZWF0ZSh7XG4gICAgbW9kZWw6IFwiY2xhdWRlLXNvbm5ldC00LTZcIixcbiAgICBtYXhfdG9rZW5zOiA2MDAsXG4gICAgc3lzdGVtOiBSRVBPUlRfU1lTVEVNX1BST01QVCxcbiAgICBtZXNzYWdlczogW1xuICAgICAge1xuICAgICAgICByb2xlOiBcInVzZXJcIixcbiAgICAgICAgY29udGVudDogYFNla3RzaW9vbjogJHtzZWN0aW9uTmFtZX1cXG5cXG5KdWhlbmQ6ICR7aW5zdHJ1Y3Rpb25zfVxcblxcbkFuZG1lZDpcXG4ke0pTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpfWAsXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIGNvbnN0IHRleHRCbG9jayA9IG1lc3NhZ2UuY29udGVudC5maW5kKChiKSA9PiBiLnR5cGUgPT09IFwidGV4dFwiKTtcbiAgaWYgKCF0ZXh0QmxvY2sgfHwgdGV4dEJsb2NrLnR5cGUgIT09IFwidGV4dFwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDbGF1ZGUgQVBJIGVpIHRhZ2FzdGFudWQgdGVrc3RpIHNla3RzaW9vbmkgXCIke3NlY3Rpb25OYW1lfVwiIGphb2tzYCk7XG4gIH1cbiAgcmV0dXJuIHRleHRCbG9jay50ZXh0LnRyaW0oKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlUmVwb3J0KFxuICBpbnB1dDogUmVwb3J0SW5wdXQsXG4gIGFwaUtleTogc3RyaW5nLFxuICBjbGllbnQ/OiBBbnRocm9waWMsXG4pOiBQcm9taXNlPFJlcG9ydD4ge1xuICBjb25zdCBhbnRocm9waWMgPSBjbGllbnQgPz8gbmV3IEFudGhyb3BpYyh7IGFwaUtleSB9KTtcbiAgY29uc3QgeyBwcm9maWxlLCBzY29yaW5nUmVzdWx0LCBhY3Rpb25QbGFuLCBreVJlYWRpbmVzcywgbWF0Y2hlZEdyYW50cyB9ID0gaW5wdXQ7XG5cbiAgY29uc3QgW2ZpbmFudHNwcm9maWlsVGV4dCwgc2tvb3JpZFRleHQsIHJpc2tpZFRleHQsIHZvaW1hbHVzZWRUZXh0LCB0ZWdldnVza2F2YVRleHQsIHRvZXR1c2VkVGV4dCwga3lUZXh0XSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgZ2VuZXJhdGVTZWN0aW9uKFxuICAgICAgICBhbnRocm9waWMsXG4gICAgICAgIFwiRmluYW50c3Byb2ZpaWxcIixcbiAgICAgICAgXCJLaXJqZWxkYSBsXHUwMEZDaGlkYWx0IGFuYWxcdTAwRkNcdTAwRkNzaXR1ZCBcdTAwRkNrc3VzdCBqYSBwZXJpb29kaS5cIixcbiAgICAgICAgcHJvZmlsZSxcbiAgICAgICksXG4gICAgICBnZW5lcmF0ZVNlY3Rpb24oXG4gICAgICAgIGFudGhyb3BpYyxcbiAgICAgICAgXCJTa29vcmlkXCIsXG4gICAgICAgIFwiU2VsZ2l0YSBrb29uZHNrb29yaSBqYSByaXNraXRhc2V0IGtyaXRlZXJpdW1pdGUgbFx1MDBGNWlrZXMuXCIsXG4gICAgICAgIHsgc2NvcmU6IHNjb3JpbmdSZXN1bHQuc2NvcmUsIHJpc2tfbGV2ZWw6IHNjb3JpbmdSZXN1bHQucmlza19sZXZlbCwgYnJlYWtkb3duOiBzY29yaW5nUmVzdWx0LmJyZWFrZG93biB9LFxuICAgICAgKSxcbiAgICAgIGdlbmVyYXRlU2VjdGlvbihcbiAgICAgICAgYW50aHJvcGljLFxuICAgICAgICBcIlJpc2tpZFwiLFxuICAgICAgICBcIlRvbyB2XHUwMEU0bGphIHBlYW1pc2VkIG5cdTAwRjVya3VzZWQgamEgcmlza2lkLlwiLFxuICAgICAgICB7IHdlYWtuZXNzZXM6IHNjb3JpbmdSZXN1bHQud2Vha25lc3Nlcywgcmlza19sZXZlbDogc2NvcmluZ1Jlc3VsdC5yaXNrX2xldmVsIH0sXG4gICAgICApLFxuICAgICAgZ2VuZXJhdGVTZWN0aW9uKFxuICAgICAgICBhbnRocm9waWMsXG4gICAgICAgIFwiVlx1MDBGNWltYWx1c2VkXCIsXG4gICAgICAgIFwiVG9vIHZcdTAwRTRsamEgdHVnZXZ1c2VkIGphIHBvc2l0aWl2c2VkIHNpZ25hYWxpZC5cIixcbiAgICAgICAgeyBzdHJlbmd0aHM6IHNjb3JpbmdSZXN1bHQuc3RyZW5ndGhzIH0sXG4gICAgICApLFxuICAgICAgZ2VuZXJhdGVTZWN0aW9uKFxuICAgICAgICBhbnRocm9waWMsXG4gICAgICAgIFwiVGVnZXZ1c2thdmFcIixcbiAgICAgICAgYWN0aW9uUGxhblxuICAgICAgICAgID8gXCJLb2trdXZcdTAwRjV0YSBzb292aXRhdHVkIHRlZ2V2dXNlZCBwcmlvcml0ZWVkaSBqXHUwMEU0cmdpLlwiXG4gICAgICAgICAgOiBcIlRlZ2V2dXNrYXZhIGVpIG9sZSBzZWxsZSBzZWdtZW5kaSBqYW9rcyBnZW5lcmVlcml0dWQgKEtcdTAwREMgc2VnbWVudCBrYXN1dGFiIHZhbG1pc29sZWt1IHNhbW11c2lkKS5cIixcbiAgICAgICAgYWN0aW9uUGxhbiA/PyBreVJlYWRpbmVzcz8ubmV4dF9zdGVwcyA/PyBbXSxcbiAgICAgICksXG4gICAgICBnZW5lcmF0ZVNlY3Rpb24oXG4gICAgICAgIGFudGhyb3BpYyxcbiAgICAgICAgXCJUb2V0dXNlZFwiLFxuICAgICAgICBtYXRjaGVkR3JhbnRzLmxlbmd0aCA+IDBcbiAgICAgICAgICA/IFwiVHV0dnVzdGEgc29iaXZhaWQgdG9ldHVzcHJvZ3JhbW1lLlwiXG4gICAgICAgICAgOiBcIlx1MDBEQ2h0ZWdpIHNvYml2YXQgdG9ldHVzcHJvZ3JhbW1pIGVpIGxlaXR1ZCBwcmFlZ3VzdGUga3JpdGVlcml1bWl0ZSBhbHVzZWwuXCIsXG4gICAgICAgIG1hdGNoZWRHcmFudHMsXG4gICAgICApLFxuICAgICAgcHJvZmlsZS5zZWdtZW50ID09PSBcImt5XCIgJiYga3lSZWFkaW5lc3NcbiAgICAgICAgPyBnZW5lcmF0ZVNlY3Rpb24oXG4gICAgICAgICAgICBhbnRocm9waWMsXG4gICAgICAgICAgICBcIktcdTAwREMgdmFsbWlzb2xla1wiLFxuICAgICAgICAgICAgXCJLb2trdXZcdTAwRjV0YSB2YWxtaXNvbGVrdSBzdGFhdHVzIGphIGpcdTAwRTRyZ21pc2VkIHNhbW11ZCBLcmVkRXgvRUlTIHRhb3RsdXNlbmkuXCIsXG4gICAgICAgICAgICBreVJlYWRpbmVzcyxcbiAgICAgICAgICApXG4gICAgICAgIDogUHJvbWlzZS5yZXNvbHZlKFwiXCIpLFxuICAgIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZ2VuZXJhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgcHJvZmlsZSxcbiAgICBzZWN0aW9uczoge1xuICAgICAgZmluYW50c3Byb2ZpaWw6IHsgaGVhZGluZzogXCJGaW5hbnRzcHJvZmlpbFwiLCBuYXJyYXRpdmU6IGZpbmFudHNwcm9maWlsVGV4dCB9LFxuICAgICAgc2tvb3JpZDogeyBoZWFkaW5nOiBcIlNrb29yaWRcIiwgbmFycmF0aXZlOiBza29vcmlkVGV4dCB9LFxuICAgICAgcmlza2lkOiB7IGhlYWRpbmc6IFwiUmlza2lkXCIsIG5hcnJhdGl2ZTogcmlza2lkVGV4dCB9LFxuICAgICAgdm9pbWFsdXNlZDogeyBoZWFkaW5nOiBcIlZcdTAwRjVpbWFsdXNlZFwiLCBuYXJyYXRpdmU6IHZvaW1hbHVzZWRUZXh0IH0sXG4gICAgICB0ZWdldnVza2F2YTogeyBoZWFkaW5nOiBcIlRlZ2V2dXNrYXZhXCIsIG5hcnJhdGl2ZTogdGVnZXZ1c2thdmFUZXh0IH0sXG4gICAgICB0b2V0dXNlZDogeyBoZWFkaW5nOiBcIlRvZXR1c2VkXCIsIG5hcnJhdGl2ZTogdG9ldHVzZWRUZXh0IH0sXG4gICAgICBreV92YWxtaXNvbGVrOlxuICAgICAgICBwcm9maWxlLnNlZ21lbnQgPT09IFwia3lcIiAmJiBreVJlYWRpbmVzc1xuICAgICAgICAgID8geyBoZWFkaW5nOiBcIktcdTAwREMgdmFsbWlzb2xla1wiLCBuYXJyYXRpdmU6IGt5VGV4dCB9XG4gICAgICAgICAgOiBudWxsLFxuICAgIH0sXG4gICAgcmF3X2RhdGE6IHtcbiAgICAgIHNjb3JlOiBzY29yaW5nUmVzdWx0LnNjb3JlLFxuICAgICAgcmlza19sZXZlbDogc2NvcmluZ1Jlc3VsdC5yaXNrX2xldmVsLFxuICAgICAgYnJlYWtkb3duOiBzY29yaW5nUmVzdWx0LmJyZWFrZG93bixcbiAgICAgIGFjdGlvbl9wbGFuOiBhY3Rpb25QbGFuID8/IG51bGwsXG4gICAgICBtYXRjaGVkX2dyYW50czogbWF0Y2hlZEdyYW50cyxcbiAgICAgIGt5X3JlYWRpbmVzczoga3lSZWFkaW5lc3MgPz8gbnVsbCxcbiAgICB9LFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOzs7QUNJQSxpQkFBc0I7QUFvRXRCLElBQU0sdUJBQXVCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVU3QixlQUFlLGdCQUNiLFdBQ0EsYUFDQSxjQUNBLE1BQ2lCO0FBQ2pCLFFBQU0sVUFBVSxNQUFNLFVBQVUsU0FBUyxPQUFPO0FBQUEsSUFDOUMsT0FBTztBQUFBLElBQ1AsWUFBWTtBQUFBLElBQ1osUUFBUTtBQUFBLElBQ1IsVUFBVTtBQUFBLE1BQ1I7QUFBQSxRQUNFLE1BQU07QUFBQSxRQUNOLFNBQVMsY0FBYyxXQUFXO0FBQUE7QUFBQSxVQUFlLFlBQVk7QUFBQTtBQUFBO0FBQUEsRUFBZ0IsS0FBSyxVQUFVLE1BQU0sTUFBTSxDQUFDLENBQUM7QUFBQSxNQUM1RztBQUFBLElBQ0Y7QUFBQSxFQUNGLENBQUM7QUFFRCxRQUFNLFlBQVksUUFBUSxRQUFRLEtBQUssQ0FBQyxNQUFNLEVBQUUsU0FBUyxNQUFNO0FBQy9ELE1BQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRO0FBQzNDLFVBQU0sSUFBSSxNQUFNLCtDQUErQyxXQUFXLFNBQVM7QUFBQSxFQUNyRjtBQUNBLFNBQU8sVUFBVSxLQUFLLEtBQUs7QUFDN0I7QUFFQSxlQUFzQixlQUNwQixP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
