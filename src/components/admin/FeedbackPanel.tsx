"use client";
import { useCallback, useEffect, useState } from "react";
import { type FeedbackDTO, FeedbackThread, fmtDate, KIND_LABEL, STATUS_LABEL } from "@/components/feedback/FeedbackThread";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const TABS: Array<[FeedbackDTO["status"], string]> = [
  ["OPEN", "Javob kutayotganlar"],
  ["ANSWERED", "Javob berilganlar"],
  ["CLOSED", "Yopilganlar"],
];

/** Admin va moderatorlar: murojaatlarni ko‘rish, javob berish, yopish. */
export function FeedbackPanel() {
  const toast = useToast();
  const [status, setStatus] = useState<FeedbackDTO["status"]>("OPEN");
  const [items, setItems] = useState<FeedbackDTO[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api<{ items: FeedbackDTO[] }>(`/api/admin/feedback?status=${status}`).then((d) => setItems(d.items)), [status]);
  useEffect(() => {
    setItems(null);
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function toggle(it: FeedbackDTO) {
    if (open === it.id) return setOpen(null);
    setOpen(it.id);
    if (it.staffUnread) {
      const r = await api<{ item: FeedbackDTO }>(`/api/feedback/${it.id}`).catch(() => null);
      if (r) replace(r.item);
    }
  }
  // Holati o‘zgargan murojaat joriy ro‘yxatdan chiqadi (masalan, javob berilgach — "Javob berilganlar"ga)
  const replace = (next: FeedbackDTO) => setItems((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)));

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap gap-1 p-1.5">
        {TABS.map(([k, v]) => (
          <button key={k} type="button" className={`rounded-xl px-3.5 py-2 font-semibold ${status === k ? "bg-accent text-accent-ink" : "text-ink-soft"}`} onClick={() => setStatus(k)} aria-pressed={status === k}>
            {v}
          </button>
        ))}
      </div>
      {!items && <Spinner />}
      {items?.length === 0 && <p className="text-ink-muted">Bu bo‘limda murojaat yo‘q.</p>}
      <ul className="flex flex-col gap-3">
        {items?.map((it) => (
          <li key={it.id} className="glass p-4">
            <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => toggle(it)} aria-expanded={open === it.id}>
              <span className="chip text-ink-soft">{KIND_LABEL[it.kind]}</span>
              <strong className="text-lg">{it.subject}</strong>
              <span className={`chip ${STATUS_LABEL[it.status].cls}`}>{STATUS_LABEL[it.status].text}</span>
              {it.staffUnread && <span className="chip bg-info-soft text-info">Yangi xabar</span>}
              <span className="ml-auto text-sm text-ink-muted">
                {it.user.name} · {it.user.email} · {fmtDate(it.lastMessageAt)}
              </span>
            </button>
            {open === it.id && (
              <div className="mt-3">
                <FeedbackThread item={it} staff onChange={replace} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
