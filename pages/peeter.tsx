import PeeterChat from "../components/PeeterChat";

export default function PeeterPage() {
  return (
    <div className="page">
      <div className="eyebrow">Vestlus</div>
      <h1>Räägi Peetriga</h1>
      <p className="text-soft" style={{ marginBottom: "1.5rem" }}>
        Peeter kaardistab su olukorra ja koostab õige dokumendi. Numbreid ta ise ei arva —
        need küsib ta sinult ja kinnitad enne, kui need dokumenti lähevad.
      </p>
      <PeeterChat />
    </div>
  );
}
