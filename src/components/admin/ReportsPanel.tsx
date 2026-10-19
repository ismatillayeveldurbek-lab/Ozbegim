"use client";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

/* eslint-disable @typescript-eslint/no-explicit-any */
const REASON: Record<string, string> = { SPAM: "Spam", OFFENSIVE: "Haqoratli", WRONG: "Noto‘g‘ri ma’lumot", OTHER: "Boshqa" };

export function ReportsPanel() {
  const [status, setStatus] = useState("OPEN");
  const [items, setItems] = useState<any[] | null>(null);
  const toast = useToast();
  const load = useCallback(() => api<{ items: any[] }>(`/api/admin/reports?status=${status}`).then((d) => setItems(d.items)), [status]);
  useEffect(() => {
    setItems(null);
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const act = async (id: string, action: string) => {
    try {
      await api(`/api/admin/reports/${id}`, { method: "PATCH", json: { action } });
      toast.success("Qaror saqlandi.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap gap-1 p-1.5">
        {[
          ["OPEN", "Ochiq"],
          ["RESOLVED", "Hal qilingan"],
          ["DISMISSED", "Rad etilgan"],
        ].map(([k, v]) => (
          <button key={k} type="button" className={`rounded-xl px-3.5 py-2 font-semibold ${status === k ? "bg-accent text-accent-ink" : "text-ink-soft"}`} onClick={() => setStatus(k)} aria-pressed={status === k}>
            {v}
          </button>
        ))}
      </div>
      {!items && <Spinner />}
      {items?.length === 0 && <p className="text-ink-muted">Shikoyatlar yo‘q.</p>}
      <ul className="flex flex-col gap-3">
        {items?.map((r) => (
          <li key={r.id} className="glass p-4">
            <p className="text-sm text-ink-muted">
              Sabab: <strong>{REASON[r.reason]}</strong> · shikoyatchi: {r.reporter.name} · “{r.comment.discussion.displayTerm}” · izoh holati: {r.comment.status}
              {r.decision ? ` · qaror: ${r.decision}` : ""}
            </p>
            <p className="mt-1 font-bold">{r.comment.proposal}</p>
            <p className="text-ink-soft">{r.comment.explanation}</p>
            <p className="text-sm text-ink-muted">Muallif: {r.comment.user.name}</p>
            {r.status === "OPEN" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(r.id, "dismiss")}>
                  Shikoyatni rad etish
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(r.id, "hide_comment")}>
                  Izohni yashirish
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => act(r.id, "reject_comment")}>
                  Izohni rad etish
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
