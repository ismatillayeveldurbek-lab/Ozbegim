"use client";
import { MessageSquarePlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { type FeedbackDTO, FeedbackThread, fmtDate, KIND_LABEL, STATUS_LABEL } from "./FeedbackThread";

/** Foydalanuvchi: yangi murojaat yuborish va o‘z murojaatlari bilan yozishma. */
export function FeedbackCenter() {
  const toast = useToast();
  const page = useSearchParams().get("sahifa") ?? "";
  const [kind, setKind] = useState<FeedbackDTO["kind"]>("BUG");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FeedbackDTO[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => api<{ items: FeedbackDTO[] }>("/api/feedback").then((d) => setItems(d.items)), []);
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ item: FeedbackDTO }>("/api/feedback", { method: "POST", json: { kind, subject, body, pageUrl: page || undefined } });
      setSubject("");
      setBody("");
      setItems((list) => [r.item, ...(list ?? [])]);
      setOpen(r.item.id);
      toast.success("Murojaatingiz yuborildi. Javob shu sahifada ko‘rinadi.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: FeedbackDTO) {
    if (open === it.id) return setOpen(null);
    setOpen(it.id);
    if (it.userUnread) {
      const r = await api<{ item: FeedbackDTO }>(`/api/feedback/${it.id}`).catch(() => null);
      if (r) replace(r.item);
    }
  }
  const replace = (next: FeedbackDTO) => setItems((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)));

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="glass flex flex-col gap-3 p-4 sm:p-5">
        <h3 className="text-lg font-bold">Yangi murojaat</h3>
        <div role="radiogroup" aria-label="Murojaat turi" className="flex flex-wrap gap-1">
          {(Object.keys(KIND_LABEL) as FeedbackDTO["kind"][]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-xl px-4 py-2 font-semibold ${kind === k ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label htmlFor="fb-subject" className="font-semibold">
          Mavzu
        </label>
        <input id="fb-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="Masalan: Imlo tekshiruvi vergulni topmadi" required />
        <label htmlFor="fb-body" className="font-semibold">
          Xabar
        </label>
        <textarea
          id="fb-body"
          className="field min-h-32"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          placeholder="Nima bo‘ldi, qaysi sahifada, qanday matn kiritdingiz — iloji boricha batafsil yozing."
          required
        />
        {page && <p className="text-sm text-ink-muted">Sahifa: {page}</p>}
        <button className="btn btn-primary self-start" disabled={busy}>
          <MessageSquarePlus className="h-5 w-5" aria-hidden /> Yuborish
        </button>
      </form>

      <section aria-labelledby="my-fb" className="flex flex-col gap-3">
        <h3 id="my-fb" className="text-lg font-bold">
          Mening murojaatlarim
        </h3>
        {!items && <Spinner />}
        {items?.length === 0 && <EmptyState title="Hozircha murojaat yo‘q">Yuborgan murojaatlaringiz va ularga berilgan javoblar shu yerda ko‘rinadi.</EmptyState>}
        {items?.map((it) => (
          <article key={it.id} className="glass p-4">
            <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => toggle(it)} aria-expanded={open === it.id}>
              <span className="chip text-ink-soft">{KIND_LABEL[it.kind]}</span>
              <strong className="text-lg">{it.subject}</strong>
              <span className={`chip ${STATUS_LABEL[it.status].cls}`}>{STATUS_LABEL[it.status].text}</span>
              {it.userUnread && <span className="chip bg-info-soft text-info">Yangi javob</span>}
              <span className="ml-auto text-sm text-ink-muted">{fmtDate(it.lastMessageAt, false)}</span>
            </button>
            {open === it.id && (
              <div className="mt-3">
                <FeedbackThread item={it} staff={false} onChange={replace} />
              </div>
            )}
          </article>
        ))}
      </section>
      <Notice kind="info">Murojaatlaringizni faqat siz va sayt administratorlari (moderatorlar) ko‘radi.</Notice>
    </div>
  );
}
