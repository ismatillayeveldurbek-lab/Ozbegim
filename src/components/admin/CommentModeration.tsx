"use client";
import { useCallback, useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

/* eslint-disable @typescript-eslint/no-explicit-any */
type C = Record<string, any>;
const STATUS_LABEL: Record<string, string> = { VISIBLE: "Ko‘rinadi", HIDDEN: "Yashirilgan", REJECTED: "Rad etilgan", ACCEPTED: "Qabul qilingan" };

function PromoteForm({ c, onDone }: { c: C; onDone: () => void }) {
  const toast = useToast();
  const [word, setWord] = useState(c.discussion.displayTerm);
  const [alt, setAlt] = useState(c.proposal);
  const [usage, setUsage] = useState("");
  const [meaning, setMeaning] = useState(c.explanation);
  const [example, setExample] = useState(c.example ?? "");
  const [status, setStatus] = useState("VERIFIED");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-2xl border border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await api(`/api/admin/comments/${c.id}/promote`, {
            method: "POST",
            json: {
              word,
              meaning,
              status,
              alternatives: alt.trim() ? [{ text: alt, usageNote: usage || null }] : [],
              examples: example.trim() ? [example] : [],
              source: c.sourceUrl ? { title: `Hamjamiyat taklifi: ${c.sourceUrl}`.slice(0, 300), url: c.sourceUrl } : null,
            },
          });
          toast.success("Taklif lug‘at yozuviga aylantirildi.");
          onDone();
        } catch (e2) {
          setErr((e2 as Error).message);
        }
      }}
    >
      <p className="font-semibold">Tahrirlab lug‘at yozuviga aylantirish</p>
      <p className="text-sm text-ink-muted">Bu so‘z bazada bo‘lsa, yozuv shu ma’lumotlar bilan yangilanadi.</p>
      {[
        ["So‘z", word, setWord],
        ["O‘zbekcha muqobil (bo‘sh bo‘lishi mumkin)", alt, setAlt],
        ["Muqobilning qo‘llanish vaziyati", usage, setUsage],
        ["Ma’nosi (izoh)", meaning, setMeaning],
        ["Misol", example, setExample],
      ].map(([label, v, set], i) => (
        <div key={i} className="flex flex-col gap-1">
          <label htmlFor={`p${c.id}${i}`} className="text-sm font-semibold">
            {label as string}
          </label>
          <input id={`p${c.id}${i}`} className="field" value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} />
        </div>
      ))}
      <label className="text-sm font-semibold" htmlFor={`ps${c.id}`}>
        Holat
      </label>
      <select id={`ps${c.id}`} className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="VERIFIED">Tasdiqlangan</option>
        <option value="PENDING">Tekshirilmoqda</option>
      </select>
      {err && <Notice kind="danger">{err}</Notice>}
      <button className="btn btn-primary self-start">Saqlash</button>
    </form>
  );
}

export function CommentModeration() {
  const [status, setStatus] = useState("VISIBLE");
  const [items, setItems] = useState<C[] | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const toast = useToast();
  const load = useCallback(() => api<{ items: C[] }>(`/api/admin/comments?status=${status}`).then((d) => setItems(d.items)), [status]);
  useEffect(() => {
    setItems(null);
    load().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function act(id: string, action: string) {
    try {
      await api(`/api/admin/comments/${id}`, { method: "PATCH", json: { action } });
      toast.success("Qaror saqlandi.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap gap-1 p-1.5">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <button key={k} type="button" className={`rounded-xl px-3.5 py-2 font-semibold ${status === k ? "bg-accent text-accent-ink" : "text-ink-soft"}`} onClick={() => setStatus(k)} aria-pressed={status === k}>
            {v}
          </button>
        ))}
      </div>
      {!items && <Spinner />}
      {items?.length === 0 && <p className="text-ink-muted">Bu holatda izoh yo‘q.</p>}
      <ul className="flex flex-col gap-3">
        {items?.map((c) => (
          <li key={c.id} className="glass p-4">
            <p className="text-sm text-ink-muted">
              “{c.discussion.displayTerm}” · {c.user.name} ({c.user.email}) · ovoz: {c.score}
              {c._count.reports ? ` · ochiq shikoyat: ${c._count.reports}` : ""}
            </p>
            <p className="mt-1 text-lg font-bold">{c.proposal}</p>
            <p className="whitespace-pre-line text-ink-soft">{c.explanation}</p>
            {c.example && <p className="italic text-ink-soft">Misol: {c.example}</p>}
            {c.sourceUrl && <p className="break-all text-sm">Manba: {c.sourceUrl}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status !== "VISIBLE" && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(c.id, "show")}>
                  Ko‘rsatish
                </button>
              )}
              {c.status !== "HIDDEN" && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(c.id, "hide")}>
                  Yashirish
                </button>
              )}
              {c.status !== "REJECTED" && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => act(c.id, "reject")}>
                  Rad etish
                </button>
              )}
              {c.discussion.kind === "LOANWORD" && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setPromoting(promoting === c.id ? null : c.id)}>
                  Lug‘at yozuviga aylantirish
                </button>
              )}
            </div>
            {promoting === c.id && (
              <PromoteForm
                c={c}
                onDone={() => {
                  setPromoting(null);
                  load();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
