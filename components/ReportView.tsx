import type { Report } from "../lib/reporting";

interface ReportViewProps {
  report: Report;
}

export default function ReportView({ report }: ReportViewProps) {
  const sectionOrder: Array<keyof Report["sections"]> = [
    "finantsprofiil",
    "skoorid",
    "riskid",
    "voimalused",
    "tegevuskava",
    "toetused",
    "ky_valmisolek",
  ];

  return (
    <div>
      <div className="eyebrow">Raport · genereeritud {new Date(report.generated_at).toLocaleString("et-EE")}</div>
      <h1>{report.profile.entity_name}</h1>
      <p className="text-soft">{report.profile.period_analyzed}</p>

      <div className="ledger-rule" />

      {sectionOrder.map((key) => {
        const section = report.sections[key];
        if (!section) return null;
        return (
          <div key={key} className="card">
            <h2>{section.heading}</h2>
            <p>{section.narrative}</p>
          </div>
        );
      })}
    </div>
  );
}
