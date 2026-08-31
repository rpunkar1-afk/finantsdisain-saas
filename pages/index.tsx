import Link from "next/link";

interface Tile {
  letter: string;
  title: string;
  description: string;
  color: "blue" | "purple";
  href?: string;
}

const TILES: Tile[] = [
  { letter: "Ä", title: "Äriplaan", description: "Täismahus plaan pangale või investorile, 20–30 lk.", color: "blue", href: "/tools/ariplaan" },
  { letter: "F", title: "Finantsprognoos", description: "3 aasta kasumiaruanne, bilanss ja rahavoog.", color: "purple", href: "/tools/finantsprognoos" },
  { letter: "R", title: "Riskianalüüs", description: "Riskid, mõju, tõenäosus ja leevendusmeetmed.", color: "blue", href: "/tools/riskianaluus" },
  { letter: "K", title: "KPI raport", description: "Juhtimisarvestuse ülevaade kuu või kvartali kohta.", color: "purple", href: "/tools/kpi-raport" },
  {
    letter: "P",
    title: "Projektitaotlus",
    description: "Üldkoosoleku otsus, hooldusfond, energiamärgis — tee KredEx/EIS taotluseni.",
    color: "purple",
    href: "/ky",
  },
  { letter: "S", title: "SWOT", description: "Tugevused, nõrkused, võimalused, ohud.", color: "blue", href: "/tools/swot" },
  { letter: "I", title: "Investoripitch", description: "12 slaidi koos numbritega ja küsimusega.", color: "purple", href: "/tools/investoripitch" },
  {
    letter: "D",
    title: "Finantsdiagnostika",
    description: "Pangaväljavõtte analüüs ja finantsskoor 0–100 — DSCR, käive, kulud, maksuvõlg.",
    color: "blue",
    href: "/vke",
  },
  { letter: "C", title: "Rahavoo mudel", description: "12 kuu likviidsusvaade koos stsenaariumitega.", color: "blue", href: "/tools/rahavoo-mudel" },
];

function TileCard({ tile }: { tile: Tile }) {
  const inner = (
    <>
      <div className="tile-top">
        <div className="tile-avatar">{tile.letter}</div>
        <div className="tile-badge">{tile.href ? "Valmis" : "Tulemas"}</div>
      </div>
      <h3>{tile.title}</h3>
      <p>{tile.description}</p>
    </>
  );
  const className = `tile ${tile.color === "purple" ? "purple" : ""} ${tile.href ? "" : "tulemas"}`.trim();
  if (tile.href) {
    return (
      <Link href={tile.href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export default function Home() {
  return (
    <div className="page-wide">
      <div className="workspace-header">
        <div className="eyebrow">Tööruum</div>
        <h1>Mida soovid täna luua?</h1>
        <p>
          Räägi Peetriga, kui pole kindel, mida vajad — ta kaardistab olukorra ja valib õige
          dokumendi. Kui tead juba täpselt, vali otse alt ruudustikust.
        </p>
        <div className="hero-actions" style={{ marginTop: "1.25rem" }}>
          <Link href="/peeter" className="button">
            Räägi Peetriga
          </Link>
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "0.5rem" }}>
        Või vali otse
      </div>
      <div className="tile-grid">
        {TILES.map((tile) => (
          <TileCard key={tile.title} tile={tile} />
        ))}
      </div>

      <div className="stat-strip">
        <div>
          <span className="stat-number">22 000+</span>
          <span className="stat-label">Eesti korteriühistut potentsiaalses sihtrühmas</span>
        </div>
        <div>
          <span className="stat-number">640M€+</span>
          <span className="stat-label">KÜ-de laenumaht Eesti pangandusturul</span>
        </div>
        <div>
          <span className="stat-number">0</span>
          <span className="stat-label">Otsest konkurenti KÜ laenuvalmiduse hindamises</span>
        </div>
      </div>

      <div className="ledger-rule" />

      <h2>Protsess</h2>
      <ol className="numbered-steps">
        <li>Laadige üles pangaväljavõte (VKE) või vastake KÜ küsimustikule.</li>
        <li>Saate deterministliku 0–100 skoori ja riskitaseme koos põhjendusega.</li>
        <li>Saate prioriseeritud tegevuskava nõrkade kohtade parandamiseks.</li>
        <li>Vaadake sobivaid KredEx/EIS toetusprogramme.</li>
        <li>Genereerige lõplik raport taotluse ettevalmistamiseks.</li>
      </ol>
    </div>
  );
}
