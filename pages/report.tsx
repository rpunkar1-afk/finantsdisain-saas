import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ReportView from "../components/ReportView";
import type { Report, ReportInput } from "../lib/reporting";

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const reportId = router.query.id;
    if (typeof reportId === "string") {
      // Samm 12: salvestatud raporti taastamine Netlify Blobs-ist ID järgi
      fetch(`/api/report?id=${encodeURIComponent(reportId)}`)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Raporti laadimine ebaõnnestus (${res.status})`);
          }
          return res.json();
        })
        .then((data: Report) => setReport(data))
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
      return;
    }

    const raw = sessionStorage.getItem("finantsdisain_report_input");
    if (!raw) {
      setError("Raporti sisendandmeid ei leitud. Alustage VKE või KÜ lehelt.");
      setLoading(false);
      return;
    }

    let input: ReportInput;
    try {
      input = JSON.parse(raw);
    } catch {
      setError("Salvestatud raporti sisend on vigane.");
      setLoading(false);
      return;
    }

    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Raporti genereerimine ebaõnnestus (${res.status})`);
        }
        return res.json();
      })
      .then((data: Report) => setReport(data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [router.isReady, router.query.id]);

  return (
    <div className="page">
      {loading && <p className="text-soft">Genereerin raportit…</p>}
      {error && <div className="error-box">{error}</div>}
      {report && (
        <>
          <ReportView report={report} />
          {report.report_id && (
            <p className="text-soft mono" style={{ fontSize: "0.8rem", marginTop: "1rem" }}>
              Püsiv link: /report?id={report.report_id}
            </p>
          )}
        </>
      )}
    </div>
  );
}
