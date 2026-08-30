import Link from "next/link";

export default function Home() {
  return (
    <div className="page">
      <div className="eyebrow">Finantsdisain AI</div>
      <h1>Finantsvalmiduse analüüs enne laenu- või toetustaotlust.</h1>
      <p className="text-soft" style={{ maxWidth: 560 }}>
        Laadige üles pangaväljavõte või vastake struktureeritud küsimustele — saate deterministliku
        skoori, riskianalüüsi ja samm-sammulise tegevuskava, mis põhineb Eesti panganduse ja
        KredEx/EIS nõuetel.
      </p>

      <div className="ledger-rule" />

      <div className="grid-2">
        <Link href="/vke" className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div className="eyebrow">Ettevõttele</div>
          <h2>VKE finantsvalmidus</h2>
          <p className="text-soft">
            DSCR, käibe stabiilsus, kulustruktuur, maksuvõlg — laenutaotluse valmisoleku hindamine.
          </p>
        </Link>
        <Link href="/ky" className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div className="eyebrow">Korteriühistule</div>
          <h2>KÜ valmisolek</h2>
          <p className="text-soft">
            Üldkoosoleku otsus, hooldusfond, energiamärgis — tee KredEx/EIS taotluseni.
          </p>
        </Link>
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
