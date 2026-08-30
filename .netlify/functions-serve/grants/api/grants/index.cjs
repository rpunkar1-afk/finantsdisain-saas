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

// api/grants/index.ts
var index_exports = {};
__export(index_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(index_exports);

// api/grants/data.json
var data_default = [
  {
    id: "eis-starditoetus",
    name: "Starditoetus",
    provider: "EIS (Ettev\xF5tluse ja Innovatsiooni Sihtasutus, endine EAS)",
    target_segment: "vke",
    status: "open",
    round_opens: null,
    round_closes: null,
    round_notes: "Jooksev meede, t\xE4psed taotlusvooru kuup\xE4evad tuleb kontrollida eis.ee lehelt.",
    max_amount_eur: 2e4,
    funding_rate: "80% projekti maksumusest (omafinantseering v\xE4hemalt 20%)",
    requirements: [
      "Kuni 24 kuud tegutsenud \xE4riregistrisse kantud \xE4ri\xFChing",
      "Alla 10 t\xF6\xF6taja",
      "M\xFC\xFCgitulu jooksval aastal ei \xFCleta 40 000 EUR (Tallinn/Tartu: k\xE4iben\xF5ue 80 000 EUR 2 aasta jooksul, mujal 40 000 EUR)",
      "Ei ole varem saanud EAS-i stardi- ja/v\xF5i kasvutoetust",
      "Osaline isik ei oma \xFCle 25% ettev\xF5ttest",
      "Kohustus luua v\xE4hemalt 1 t\xE4iskohaga t\xF6\xF6koht"
    ],
    description: "Toetus alustavale ettev\xF5ttele kasvu ja t\xF6\xF6kohtade loomiseks. Makstakse kahes osas: 15 000 EUR p\xE4rast t\xF6\xF6koha loomist, 5 000 EUR kahe aasta m\xF6\xF6dudes tingimuste t\xE4itmisel.",
    source_url: "https://www.rtk.ee/meede-alustava-ettevotja-starditoetus",
    last_verified: "2026-08-30"
  },
  {
    id: "eis-tootearendustootaja-toetus",
    name: "Ettev\xF5tja teadus- ja arendust\xF6\xF6taja toetus",
    provider: "EIS",
    target_segment: "vke",
    status: "open",
    round_opens: "2026-08-11T09:00:00+03:00",
    round_closes: "2026-09-07T16:00:00+03:00",
    round_notes: "5. taotlusvoor, perioodi 01.01.2026-30.06.2026 kohta.",
    max_amount_eur: null,
    funding_rate: "V\xE4hese t\xE4htsusega abi (de minimis)",
    requirements: [
      "\xC4riregistrisse kantud ettev\xF5te",
      "V\xE4hemalt 1 teadus- ja arendust\xF6\xF6taja",
      "Ei ole saanud de minimis abi \xFCle 300 000 EUR viimase 3 aasta jooksul",
      "Taotlus esitatakse E-toetuse keskkonnas, ainult eesti keeles"
    ],
    description: "Toetab T&A t\xF6\xF6tajate v\xE4rbamist ja hoidmist, eesm\xE4rgiga suurendada erasektori T&A mahtu. Kolmeaastane pilootmeede.",
    source_url: "https://eis.ee/en/services/grant-for-companies-research-and-development-employees/",
    last_verified: "2026-08-30"
  },
  {
    id: "eis-ky-rekonstrueerimistoetus",
    name: "Korterelamu rekonstrueerimistoetus",
    provider: "EIS (KredEx)",
    target_segment: "ky",
    status: "open",
    round_opens: null,
    round_closes: null,
    round_notes: "Mitmeaastane programm (2022-2027). T\xE4psed taotlusvooru t\xE4htajad ja eelarve j\xE4\xE4k tuleb kontrollida eis.ee lehelt \u2014 voorud v\xF5ivad sulguda eelarve ammendumisel enne ametlikku t\xE4htaega.",
    max_amount_eur: 1e6,
    funding_rate: "30% Tallinnas ja Tartus / 40% piirkondades kus kinnisvara turuv\xE4\xE4rtus >500 EUR/m\xB2 / 50% \xFClej\xE4\xE4nud Eestis",
    requirements: [
      "Korterelamu ehitatud enne 2000. aastat",
      "V\xE4hemalt 80% korteriomanditest f\xFC\xFCsiliste isikute (v\xF5i riigi/KOV) omandis",
      "Korteri\xFChistu peab olema moodustatud",
      "\xDCldkoosoleku otsus rekonstrueerimise ja toetuse taotlemise kohta",
      "Soovitatav: energiaaudit l\xE4htedokumendina enne taotlust"
    ],
    description: "Suurim ja tuntuim EIS/KredEx meede korterelamute terviklikuks rekonstrueerimiseks: fassaad, katus, aknad, k\xFCte, ventilatsioon, lift, keldri soojustus.",
    source_url: "https://eis.ee/en/services/kodudkorda/",
    last_verified: "2026-08-30"
  }
];

// api/grants/index.ts
var config = {
  path: "/api/grants"
};
function resolveStatus(grant, now) {
  if (grant.round_opens) {
    const opensAt = new Date(grant.round_opens);
    if (now < opensAt) return "upcoming";
  }
  if (grant.round_closes) {
    const closesAt = new Date(grant.round_closes);
    if (now > closesAt) return "closed";
  }
  return grant.status;
}
async function handler(req) {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const segmentFilter = url.searchParams.get("segment");
  const now = /* @__PURE__ */ new Date();
  let grants = data_default.map((g) => ({
    ...g,
    status: resolveStatus(g, now)
  }));
  if (statusFilter && !["open", "closed", "upcoming"].includes(statusFilter)) {
    return jsonResponse({ error: "Vigane 'status' filter (open|closed|upcoming)" }, 400);
  }
  if (segmentFilter && !["vke", "ky", "both"].includes(segmentFilter)) {
    return jsonResponse({ error: "Vigane 'segment' filter (vke|ky|both)" }, 400);
  }
  if (statusFilter) {
    grants = grants.filter((g) => g.status === statusFilter);
  }
  if (segmentFilter) {
    grants = grants.filter((g) => g.target_segment === segmentFilter || g.target_segment === "both");
  }
  return jsonResponse({ count: grants.length, grants }, 200);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpL2dyYW50cy9pbmRleC50cyIsICJhcGkvZ3JhbnRzL2RhdGEuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gTmV0bGlmeSBGdW5jdGlvbiAodjIsIFdlYiBBUEkgaGFuZGxlcilcbi8vIFNhbW0gODogVG9ldHVzdGUgcmFkYXIgKEtpaHQgMilcbi8vIEFuZG1lYWxsaWthczoga1x1MDBFNHNpdHNpIGt1cmVlcml0YXYgZGF0YS5qc29uIChhdmF0dWQvc3VsZXR1ZC90dWxldmFzZWQgdm9vcnVkLCB0XHUwMEU0aHRhamFkLCBuXHUwMEY1dWRlZClcbi8vIFF1ZXJ5IHBhcmFtczogP3N0YXR1cz1vcGVufGNsb3NlZHx1cGNvbWluZyAgP3NlZ21lbnQ9dmtlfGt5fGJvdGhcblxuaW1wb3J0IGdyYW50c0RhdGEgZnJvbSBcIi4vZGF0YS5qc29uXCI7XG5cbmV4cG9ydCBjb25zdCBjb25maWcgPSB7XG4gIHBhdGg6IFwiL2FwaS9ncmFudHNcIixcbn07XG5cbmV4cG9ydCB0eXBlIEdyYW50U3RhdHVzID0gXCJvcGVuXCIgfCBcImNsb3NlZFwiIHwgXCJ1cGNvbWluZ1wiO1xuZXhwb3J0IHR5cGUgR3JhbnRTZWdtZW50ID0gXCJ2a2VcIiB8IFwia3lcIiB8IFwiYm90aFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdyYW50UHJvZ3JhbSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcHJvdmlkZXI6IHN0cmluZztcbiAgdGFyZ2V0X3NlZ21lbnQ6IEdyYW50U2VnbWVudDtcbiAgc3RhdHVzOiBHcmFudFN0YXR1cztcbiAgcm91bmRfb3BlbnM6IHN0cmluZyB8IG51bGw7XG4gIHJvdW5kX2Nsb3Nlczogc3RyaW5nIHwgbnVsbDtcbiAgcm91bmRfbm90ZXM6IHN0cmluZztcbiAgbWF4X2Ftb3VudF9ldXI6IG51bWJlciB8IG51bGw7XG4gIGZ1bmRpbmdfcmF0ZTogc3RyaW5nO1xuICByZXF1aXJlbWVudHM6IHN0cmluZ1tdO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBzb3VyY2VfdXJsOiBzdHJpbmc7XG4gIGxhc3RfdmVyaWZpZWQ6IHN0cmluZztcbn1cblxuLy8gVHVsZXRhYiB0ZWdlbGlrdSBzdGFhdHVzZSBrdXVwXHUwMEU0ZXZhZGUgcFx1MDBGNWhqYWwsIGt1aSBuZWVkIG9uIG1cdTAwRTRcdTAwRTRyYXR1ZC5cbi8vIEt1aSByb3VuZF9vcGVucy9yb3VuZF9jbG9zZXMgcHV1ZHV2YWQgKGpvb2tzZXYvbWl0bWVhYXN0YW5lIG1lZWRlKSwgdXNhbGRhdGFrc2Vcbi8vIGt1cmVlcml0dWQgXCJzdGF0dXNcIiB2XHUwMEU0bGphIG90c2UuXG5mdW5jdGlvbiByZXNvbHZlU3RhdHVzKGdyYW50OiBHcmFudFByb2dyYW0sIG5vdzogRGF0ZSk6IEdyYW50U3RhdHVzIHtcbiAgaWYgKGdyYW50LnJvdW5kX29wZW5zKSB7XG4gICAgY29uc3Qgb3BlbnNBdCA9IG5ldyBEYXRlKGdyYW50LnJvdW5kX29wZW5zKTtcbiAgICBpZiAobm93IDwgb3BlbnNBdCkgcmV0dXJuIFwidXBjb21pbmdcIjtcbiAgfVxuICBpZiAoZ3JhbnQucm91bmRfY2xvc2VzKSB7XG4gICAgY29uc3QgY2xvc2VzQXQgPSBuZXcgRGF0ZShncmFudC5yb3VuZF9jbG9zZXMpO1xuICAgIGlmIChub3cgPiBjbG9zZXNBdCkgcmV0dXJuIFwiY2xvc2VkXCI7XG4gIH1cbiAgcmV0dXJuIGdyYW50LnN0YXR1cztcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihyZXE6IFJlcXVlc3QpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gIGlmIChyZXEubWV0aG9kICE9PSBcIkdFVFwiKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0sIDQwNSk7XG4gIH1cblxuICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwpO1xuICBjb25zdCBzdGF0dXNGaWx0ZXIgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcInN0YXR1c1wiKSBhcyBHcmFudFN0YXR1cyB8IG51bGw7XG4gIGNvbnN0IHNlZ21lbnRGaWx0ZXIgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcInNlZ21lbnRcIikgYXMgR3JhbnRTZWdtZW50IHwgbnVsbDtcblxuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICBsZXQgZ3JhbnRzID0gKGdyYW50c0RhdGEgYXMgR3JhbnRQcm9ncmFtW10pLm1hcCgoZykgPT4gKHtcbiAgICAuLi5nLFxuICAgIHN0YXR1czogcmVzb2x2ZVN0YXR1cyhnLCBub3cpLFxuICB9KSk7XG5cbiAgaWYgKHN0YXR1c0ZpbHRlciAmJiAhW1wib3BlblwiLCBcImNsb3NlZFwiLCBcInVwY29taW5nXCJdLmluY2x1ZGVzKHN0YXR1c0ZpbHRlcikpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiVmlnYW5lICdzdGF0dXMnIGZpbHRlciAob3BlbnxjbG9zZWR8dXBjb21pbmcpXCIgfSwgNDAwKTtcbiAgfVxuICBpZiAoc2VnbWVudEZpbHRlciAmJiAhW1widmtlXCIsIFwia3lcIiwgXCJib3RoXCJdLmluY2x1ZGVzKHNlZ21lbnRGaWx0ZXIpKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIlZpZ2FuZSAnc2VnbWVudCcgZmlsdGVyICh2a2V8a3l8Ym90aClcIiB9LCA0MDApO1xuICB9XG5cbiAgaWYgKHN0YXR1c0ZpbHRlcikge1xuICAgIGdyYW50cyA9IGdyYW50cy5maWx0ZXIoKGcpID0+IGcuc3RhdHVzID09PSBzdGF0dXNGaWx0ZXIpO1xuICB9XG4gIGlmIChzZWdtZW50RmlsdGVyKSB7XG4gICAgZ3JhbnRzID0gZ3JhbnRzLmZpbHRlcigoZykgPT4gZy50YXJnZXRfc2VnbWVudCA9PT0gc2VnbWVudEZpbHRlciB8fCBnLnRhcmdldF9zZWdtZW50ID09PSBcImJvdGhcIik7XG4gIH1cblxuICByZXR1cm4ganNvblJlc3BvbnNlKHsgY291bnQ6IGdyYW50cy5sZW5ndGgsIGdyYW50cyB9LCAyMDApO1xufVxuXG5mdW5jdGlvbiBqc29uUmVzcG9uc2UoYm9keTogdW5rbm93biwgc3RhdHVzOiBudW1iZXIpOiBSZXNwb25zZSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICB9KTtcbn1cbiIsICJbXG4gIHtcbiAgICBcImlkXCI6IFwiZWlzLXN0YXJkaXRvZXR1c1wiLFxuICAgIFwibmFtZVwiOiBcIlN0YXJkaXRvZXR1c1wiLFxuICAgIFwicHJvdmlkZXJcIjogXCJFSVMgKEV0dGV2XHUwMEY1dGx1c2UgamEgSW5ub3ZhdHNpb29uaSBTaWh0YXN1dHVzLCBlbmRpbmUgRUFTKVwiLFxuICAgIFwidGFyZ2V0X3NlZ21lbnRcIjogXCJ2a2VcIixcbiAgICBcInN0YXR1c1wiOiBcIm9wZW5cIixcbiAgICBcInJvdW5kX29wZW5zXCI6IG51bGwsXG4gICAgXCJyb3VuZF9jbG9zZXNcIjogbnVsbCxcbiAgICBcInJvdW5kX25vdGVzXCI6IFwiSm9va3NldiBtZWVkZSwgdFx1MDBFNHBzZWQgdGFvdGx1c3Zvb3J1IGt1dXBcdTAwRTRldmFkIHR1bGViIGtvbnRyb2xsaWRhIGVpcy5lZSBsZWhlbHQuXCIsXG4gICAgXCJtYXhfYW1vdW50X2V1clwiOiAyMDAwMCxcbiAgICBcImZ1bmRpbmdfcmF0ZVwiOiBcIjgwJSBwcm9qZWt0aSBtYWtzdW11c2VzdCAob21hZmluYW50c2VlcmluZyB2XHUwMEU0aGVtYWx0IDIwJSlcIixcbiAgICBcInJlcXVpcmVtZW50c1wiOiBbXG4gICAgICBcIkt1bmkgMjQga3V1ZCB0ZWd1dHNlbnVkIFx1MDBFNHJpcmVnaXN0cmlzc2Uga2FudHVkIFx1MDBFNHJpXHUwMEZDaGluZ1wiLFxuICAgICAgXCJBbGxhIDEwIHRcdTAwRjZcdTAwRjZ0YWphXCIsXG4gICAgICBcIk1cdTAwRkNcdTAwRkNnaXR1bHUgam9va3N2YWwgYWFzdGFsIGVpIFx1MDBGQ2xldGEgNDAgMDAwIEVVUiAoVGFsbGlubi9UYXJ0dToga1x1MDBFNGliZW5cdTAwRjV1ZSA4MCAwMDAgRVVSIDIgYWFzdGEgam9va3N1bCwgbXVqYWwgNDAgMDAwIEVVUilcIixcbiAgICAgIFwiRWkgb2xlIHZhcmVtIHNhYW51ZCBFQVMtaSBzdGFyZGktIGphL3ZcdTAwRjVpIGthc3Z1dG9ldHVzdFwiLFxuICAgICAgXCJPc2FsaW5lIGlzaWsgZWkgb21hIFx1MDBGQ2xlIDI1JSBldHRldlx1MDBGNXR0ZXN0XCIsXG4gICAgICBcIktvaHVzdHVzIGx1dWEgdlx1MDBFNGhlbWFsdCAxIHRcdTAwRTRpc2tvaGFnYSB0XHUwMEY2XHUwMEY2a29odFwiXG4gICAgXSxcbiAgICBcImRlc2NyaXB0aW9uXCI6IFwiVG9ldHVzIGFsdXN0YXZhbGUgZXR0ZXZcdTAwRjV0dGVsZSBrYXN2dSBqYSB0XHUwMEY2XHUwMEY2a29odGFkZSBsb29taXNla3MuIE1ha3N0YWtzZSBrYWhlcyBvc2FzOiAxNSAwMDAgRVVSIHBcdTAwRTRyYXN0IHRcdTAwRjZcdTAwRjZrb2hhIGxvb21pc3QsIDUgMDAwIEVVUiBrYWhlIGFhc3RhIG1cdTAwRjZcdTAwRjZkdWRlcyB0aW5naW11c3RlIHRcdTAwRTRpdG1pc2VsLlwiLFxuICAgIFwic291cmNlX3VybFwiOiBcImh0dHBzOi8vd3d3LnJ0ay5lZS9tZWVkZS1hbHVzdGF2YS1ldHRldm90amEtc3RhcmRpdG9ldHVzXCIsXG4gICAgXCJsYXN0X3ZlcmlmaWVkXCI6IFwiMjAyNi0wOC0zMFwiXG4gIH0sXG4gIHtcbiAgICBcImlkXCI6IFwiZWlzLXRvb3RlYXJlbmR1c3Rvb3RhamEtdG9ldHVzXCIsXG4gICAgXCJuYW1lXCI6IFwiRXR0ZXZcdTAwRjV0amEgdGVhZHVzLSBqYSBhcmVuZHVzdFx1MDBGNlx1MDBGNnRhamEgdG9ldHVzXCIsXG4gICAgXCJwcm92aWRlclwiOiBcIkVJU1wiLFxuICAgIFwidGFyZ2V0X3NlZ21lbnRcIjogXCJ2a2VcIixcbiAgICBcInN0YXR1c1wiOiBcIm9wZW5cIixcbiAgICBcInJvdW5kX29wZW5zXCI6IFwiMjAyNi0wOC0xMVQwOTowMDowMCswMzowMFwiLFxuICAgIFwicm91bmRfY2xvc2VzXCI6IFwiMjAyNi0wOS0wN1QxNjowMDowMCswMzowMFwiLFxuICAgIFwicm91bmRfbm90ZXNcIjogXCI1LiB0YW90bHVzdm9vciwgcGVyaW9vZGkgMDEuMDEuMjAyNi0zMC4wNi4yMDI2IGtvaHRhLlwiLFxuICAgIFwibWF4X2Ftb3VudF9ldXJcIjogbnVsbCxcbiAgICBcImZ1bmRpbmdfcmF0ZVwiOiBcIlZcdTAwRTRoZXNlIHRcdTAwRTRodHN1c2VnYSBhYmkgKGRlIG1pbmltaXMpXCIsXG4gICAgXCJyZXF1aXJlbWVudHNcIjogW1xuICAgICAgXCJcdTAwQzRyaXJlZ2lzdHJpc3NlIGthbnR1ZCBldHRldlx1MDBGNXRlXCIsXG4gICAgICBcIlZcdTAwRTRoZW1hbHQgMSB0ZWFkdXMtIGphIGFyZW5kdXN0XHUwMEY2XHUwMEY2dGFqYVwiLFxuICAgICAgXCJFaSBvbGUgc2FhbnVkIGRlIG1pbmltaXMgYWJpIFx1MDBGQ2xlIDMwMCAwMDAgRVVSIHZpaW1hc2UgMyBhYXN0YSBqb29rc3VsXCIsXG4gICAgICBcIlRhb3RsdXMgZXNpdGF0YWtzZSBFLXRvZXR1c2Uga2Vza2tvbm5hcywgYWludWx0IGVlc3RpIGtlZWxlc1wiXG4gICAgXSxcbiAgICBcImRlc2NyaXB0aW9uXCI6IFwiVG9ldGFiIFQmQSB0XHUwMEY2XHUwMEY2dGFqYXRlIHZcdTAwRTRyYmFtaXN0IGphIGhvaWRtaXN0LCBlZXNtXHUwMEU0cmdpZ2Egc3V1cmVuZGFkYSBlcmFzZWt0b3JpIFQmQSBtYWh0dS4gS29sbWVhYXN0YW5lIHBpbG9vdG1lZWRlLlwiLFxuICAgIFwic291cmNlX3VybFwiOiBcImh0dHBzOi8vZWlzLmVlL2VuL3NlcnZpY2VzL2dyYW50LWZvci1jb21wYW5pZXMtcmVzZWFyY2gtYW5kLWRldmVsb3BtZW50LWVtcGxveWVlcy9cIixcbiAgICBcImxhc3RfdmVyaWZpZWRcIjogXCIyMDI2LTA4LTMwXCJcbiAgfSxcbiAge1xuICAgIFwiaWRcIjogXCJlaXMta3ktcmVrb25zdHJ1ZWVyaW1pc3RvZXR1c1wiLFxuICAgIFwibmFtZVwiOiBcIktvcnRlcmVsYW11IHJla29uc3RydWVlcmltaXN0b2V0dXNcIixcbiAgICBcInByb3ZpZGVyXCI6IFwiRUlTIChLcmVkRXgpXCIsXG4gICAgXCJ0YXJnZXRfc2VnbWVudFwiOiBcImt5XCIsXG4gICAgXCJzdGF0dXNcIjogXCJvcGVuXCIsXG4gICAgXCJyb3VuZF9vcGVuc1wiOiBudWxsLFxuICAgIFwicm91bmRfY2xvc2VzXCI6IG51bGwsXG4gICAgXCJyb3VuZF9ub3Rlc1wiOiBcIk1pdG1lYWFzdGFuZSBwcm9ncmFtbSAoMjAyMi0yMDI3KS4gVFx1MDBFNHBzZWQgdGFvdGx1c3Zvb3J1IHRcdTAwRTRodGFqYWQgamEgZWVsYXJ2ZSBqXHUwMEU0XHUwMEU0ayB0dWxlYiBrb250cm9sbGlkYSBlaXMuZWUgbGVoZWx0IFx1MjAxNCB2b29ydWQgdlx1MDBGNWl2YWQgc3VsZ3VkYSBlZWxhcnZlIGFtbWVuZHVtaXNlbCBlbm5lIGFtZXRsaWtrdSB0XHUwMEU0aHRhZWdhLlwiLFxuICAgIFwibWF4X2Ftb3VudF9ldXJcIjogMTAwMDAwMCxcbiAgICBcImZ1bmRpbmdfcmF0ZVwiOiBcIjMwJSBUYWxsaW5uYXMgamEgVGFydHVzIC8gNDAlIHBpaXJrb25kYWRlcyBrdXMga2lubmlzdmFyYSB0dXJ1dlx1MDBFNFx1MDBFNHJ0dXMgPjUwMCBFVVIvbVx1MDBCMiAvIDUwJSBcdTAwRkNsZWpcdTAwRTRcdTAwRTRudWQgRWVzdGlzXCIsXG4gICAgXCJyZXF1aXJlbWVudHNcIjogW1xuICAgICAgXCJLb3J0ZXJlbGFtdSBlaGl0YXR1ZCBlbm5lIDIwMDAuIGFhc3RhdFwiLFxuICAgICAgXCJWXHUwMEU0aGVtYWx0IDgwJSBrb3J0ZXJpb21hbmRpdGVzdCBmXHUwMEZDXHUwMEZDc2lsaXN0ZSBpc2lrdXRlICh2XHUwMEY1aSByaWlnaS9LT1YpIG9tYW5kaXNcIixcbiAgICAgIFwiS29ydGVyaVx1MDBGQ2hpc3R1IHBlYWIgb2xlbWEgbW9vZHVzdGF0dWRcIixcbiAgICAgIFwiXHUwMERDbGRrb29zb2xla3Ugb3RzdXMgcmVrb25zdHJ1ZWVyaW1pc2UgamEgdG9ldHVzZSB0YW90bGVtaXNlIGtvaHRhXCIsXG4gICAgICBcIlNvb3ZpdGF0YXY6IGVuZXJnaWFhdWRpdCBsXHUwMEU0aHRlZG9rdW1lbmRpbmEgZW5uZSB0YW90bHVzdFwiXG4gICAgXSxcbiAgICBcImRlc2NyaXB0aW9uXCI6IFwiU3V1cmltIGphIHR1bnR1aW0gRUlTL0tyZWRFeCBtZWVkZSBrb3J0ZXJlbGFtdXRlIHRlcnZpa2xpa3VrcyByZWtvbnN0cnVlZXJpbWlzZWtzOiBmYXNzYWFkLCBrYXR1cywgYWtuYWQsIGtcdTAwRkN0ZSwgdmVudGlsYXRzaW9vbiwgbGlmdCwga2VsZHJpIHNvb2p1c3R1cy5cIixcbiAgICBcInNvdXJjZV91cmxcIjogXCJodHRwczovL2Vpcy5lZS9lbi9zZXJ2aWNlcy9rb2R1ZGtvcmRhL1wiLFxuICAgIFwibGFzdF92ZXJpZmllZFwiOiBcIjIwMjYtMDgtMzBcIlxuICB9XG5dXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7O0FDQUE7QUFBQSxFQUNFO0FBQUEsSUFDRSxJQUFNO0FBQUEsSUFDTixNQUFRO0FBQUEsSUFDUixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixRQUFVO0FBQUEsSUFDVixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGdCQUFrQjtBQUFBLElBQ2xCLGNBQWdCO0FBQUEsSUFDaEIsY0FBZ0I7QUFBQSxNQUNkO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNG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
