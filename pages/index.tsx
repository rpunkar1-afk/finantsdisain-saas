import Link from "next/link";
import PeeterChat from "../components/PeeterChat";

const SEGMENTS = [
  {
    href: "/vke",
    eyebrow: "VKE",
    title: "Finantsdiagnostika ettevõttele",
    description:
      "Laadi üles pangaväljavõte ja saa deterministlik finantsskoor 0–100 — DSCR, käibe stabiilsus, kulustruktuur, maksuvõlg — koos põhjendatud tegevuskavaga.",
  },
  {
    href: "/ky",
    eyebrow: "KÜ",
    title: "Laenu- ja toetusvalmidus korteriühistule",
    description:
      "Üldkoosoleku otsus, hooldusfondi kate, energiamärgis — saa valmisoleku hinnang ja järgmised sammud KredEx/EIS taotluseni.",
  },
  {
    href: "/grants",
    eyebrow: "Toetused",
    title: "Toetuste radar",
    description:
      "Praegu avatud ja tulevased KredEx/EIS toetusprogrammid, filtreeritavad segmendi ja staatuse järgi.",
  },
];

export default function Home() {
  return (
    <div className="page-wide">
      <div className="hero">
        <div>
          <div className="eyebrow">🇪🇪 Eesti VKE-dele ja korteriühistutele</div>
          <h1>
            Selge tee <span style={{ color: "var(--color-link)" }}>rahastuseni</span>
          </h1>
          <p style={{ color: "var(--color-ink-soft)", maxWidth: "42ch" }}>
            Finantsdisain aitab teie tegelikku olukorda parandada ja selgelt esitada — mitte
            varjata ega moonutada. Räägi Peetriga paremal, kirjelda oma olukord, ja ta suunab
            sind õige tööriista ja dokumendini.
          </p>
          <div className="hero-actions">
            <Link href="/tooruum" className="button">
              Ava täisruudustik
            </Link>
            <a href="#protsess" className="button secondary">
              Kuidas see töötab
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <PeeterChat />
          <div className="hero-visual-caption">
            <span>Peeter — digitaalne finantsjuht</span>
            <span>Numbreid ta ise ei arva</span>
          </div>
        </div>
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

      <div className="eyebrow">Kellele</div>
      <h2>Kolm sihtrühma, üks süsteem</h2>
      <div className="grid-3">
        {SEGMENTS.map((s) => (
          <Link key={s.href} href={s.href} className="segment-card">
            <div className="eyebrow">{s.eyebrow}</div>
            <h3>{s.title}</h3>
            <p className="text-soft" style={{ margin: 0 }}>
              {s.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="ledger-rule" id="protsess" />

      <div className="eyebrow">Protsess</div>
      <h2>Viis sammu</h2>
      <ol className="numbered-steps">
        <li>Laadige üles pangaväljavõte (VKE) või vastake KÜ küsimustikule.</li>
        <li>Saate deterministliku 0–100 skoori ja riskitaseme koos põhjendusega.</li>
        <li>Saate prioriseeritud tegevuskava nõrkade kohtade parandamiseks.</li>
        <li>Vaadake sobivaid KredEx/EIS toetusprogramme.</li>
        <li>Genereerige lõplik raport taotluse ettevalmistamiseks.</li>
      </ol>

      <div className="ledger-rule" />

      <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Valmis alustama?</h2>
        <p className="text-soft" style={{ maxWidth: "48ch", margin: "0 auto 1.5rem" }}>
          Ava täisruudustik ja vali otse dokumendi tüüp, või jätka vestlust Peetriga ülal.
        </p>
        <Link href="/tooruum" className="button">
          Ava täisruudustik
        </Link>
      </div>

      <p className="text-soft" style={{ fontSize: "0.8rem", marginTop: "2rem", textAlign: "center" }}>
        Peeter annab suunise ja tegevuskava, mitte personaalset õigus- ega maksunõu — vajadusel
        suunab ta sind raamatupidaja või juristi poole.
      </p>
    </div>
  );
}
