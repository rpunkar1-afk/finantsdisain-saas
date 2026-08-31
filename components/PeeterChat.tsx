import { useState, useRef, useEffect } from "react";
import { getDocumentType } from "../lib/documents/registry";
import type { GeneratedDocument } from "../lib/documents/generate";
import DocumentResult from "./DocumentResult";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PendingConfirmation {
  field_id: string;
  label: string;
  value: string;
  unit?: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Tere. Räägi mulle lühidalt, mis olukorras su ettevõte või korteriühistu on ja mida vajad — laenutaotlust, finantsülevaadet, äriplaani vms. Alustame sealt.",
};

export default function PeeterChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState<string | null>(null);
  const [collected, setCollected] = useState<Record<string, string | number>>({});
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, readyToGenerate, document]);

  async function sendTurn(nextMessages: ChatMessage[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/peeter-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, documentTypeId, collected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Vestlus ebaõnnestus (${res.status})`);
      }
      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.documentTypeId) setDocumentTypeId(data.documentTypeId);
      if (data.fieldUpdates && Object.keys(data.fieldUpdates).length > 0) {
        setCollected((prev) => ({ ...prev, ...data.fieldUpdates }));
      }
      setPending(data.pendingConfirmation ?? null);
      if (data.pendingConfirmation) setConfirmValue(data.pendingConfirmation.value);
      setReadyToGenerate(!!data.readyToGenerate);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    sendTurn(next);
  }

  function handleConfirm() {
    if (!pending) return;
    const numValue = Number(confirmValue.replace(",", "."));
    setCollected((prev) => ({ ...prev, [pending.field_id]: Number.isFinite(numValue) ? numValue : confirmValue }));
    const confirmMsg: ChatMessage = {
      role: "user",
      content: `[Kinnitatud: ${pending.label} = ${confirmValue}${pending.unit ? " " + pending.unit : ""}]`,
    };
    setPending(null);
    const next = [...messages, confirmMsg];
    setMessages(next);
    sendTurn(next);
  }

  function handleReject() {
    if (!pending) return;
    setPending(null);
    setInput(`${pending.label}: `);
  }

  async function handleGenerate() {
    if (!documentTypeId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: documentTypeId, input: collected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Genereerimine ebaõnnestus (${res.status})`);
      }
      const data: GeneratedDocument = await res.json();
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  const config = documentTypeId ? getDocumentType(documentTypeId) : undefined;

  if (document && config) {
    return (
      <div>
        <div className="eyebrow">{config.title} — genereeritud vestluse põhjal</div>
        <DocumentResult document={document} config={config} />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          maxHeight: 480,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
        }}
      >
        {config && (
          <div className="eyebrow" style={{ marginBottom: 0 }}>
            Koostame: {config.title}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              background: m.role === "user" ? "var(--color-accent-soft)" : "var(--color-surface-2)",
              color: "var(--color-ink)",
              padding: "0.6rem 0.9rem",
              borderRadius: "var(--radius)",
              fontSize: "0.9rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--color-ink-faint)", fontSize: "0.85rem" }}>
            Peeter mõtleb…
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {pending && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>
            Kinnita number enne salvestamist
          </div>
          <p style={{ marginTop: 0, marginBottom: "0.6rem" }}>{pending.label}</p>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <input
              type="number"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              style={{ maxWidth: 180 }}
            />
            {pending.unit && <span className="text-soft">{pending.unit}</span>}
            <button className="button" onClick={handleConfirm} disabled={loading}>
              Kinnita
            </button>
            <button className="button secondary" onClick={handleReject} disabled={loading}>
              Muuda
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}

      {readyToGenerate && !pending && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <p style={{ marginTop: 0 }}>Kõik vajalik on kogutud. Valmis genereerima {config?.title.toLowerCase()}.</p>
          <button className="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Genereerin…" : `Genereeri ${config?.title.toLowerCase()}`}
          </button>
        </div>
      )}

      {!pending && !readyToGenerate && (
        <form onSubmit={handleSend} style={{ display: "flex", gap: "0.6rem", marginTop: "0.75rem" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Kirjuta vastus…"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="button" disabled={loading || !input.trim()}>
            Saada
          </button>
        </form>
      )}
    </div>
  );
}
