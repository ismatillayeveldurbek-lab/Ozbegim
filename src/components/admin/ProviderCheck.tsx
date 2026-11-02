"use client";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";

type Result = { provider: string; ok: boolean; model: string | null; ms: number; error: string | null };
const NAME: Record<string, string> = { gemini: "Gemini", anthropic: "Claude" };

/** Ulangan xizmatlarni bitta tugma bilan tekshirish (har biriga bitta kichik so‘rov). */
export function ProviderCheck() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResults((await api<{ results: Result[] }>("/api/admin/ai-check", { method: "POST", json: {} })).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tekshirib bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={run}>
        {busy ? "Tekshirilmoqda…" : "Xizmatlarni tekshirish"}
      </button>
      {error && <Notice kind="danger" className="mt-2">{error}</Notice>}
      {results && (
        <ul className="mt-3 flex flex-col gap-2">
          {!results.length && <li className="text-ink-muted">Hech qanday xizmat kaliti berilmagan.</li>}
          {results.map((r) => (
            <li key={r.provider} className={`rounded-xl px-3 py-2 ${r.ok ? "bg-accent-soft" : "bg-danger-soft"}`}>
              <strong>{NAME[r.provider] ?? r.provider}</strong>: {r.ok ? "ishlayapti ✅" : "ishlamayapti ❌"}{" "}
              <span className="text-sm text-ink-muted">
                {r.model && <span className="font-mono">{r.model}</span>} · {(r.ms / 1000).toFixed(1)} s
              </span>
              {r.error && <p className="text-sm">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
