"use client";
import { Flag, MessageSquarePlus, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";
import type { CommentDTO, DiscussionDTO } from "./types";

const REASONS = [
  { value: "SPAM", label: "Spam yoki reklama" },
  { value: "OFFENSIVE", label: "Haqoratli mazmun" },
  { value: "WRONG", label: "Noto‘g‘ri ma’lumot" },
  { value: "OTHER", label: "Boshqa sabab" },
];

function CommentItem({ c, onChange, loggedIn }: { c: CommentDTO; onChange: () => void; loggedIn: boolean }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [score, setScore] = useState(c.score);
  const [myVote, setMyVote] = useState(c.myVote);

  async function vote(v: 1 | -1) {
    const value = myVote === v ? 0 : v;
    try {
      const r = await api<{ score: number; myVote: number }>(`/api/comments/${c.id}/vote`, { method: "POST", json: { value } });
      setScore(r.score);
      setMyVote(r.myVote);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-[var(--glass-strong)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-info-soft text-info">
          <span aria-hidden>◆</span> Hamjamiyat taklifi
        </span>
        {c.status === "ACCEPTED" && <span className="chip bg-accent-soft text-accent">✓ Moderator qabul qilgan</span>}
        {c.status === "HIDDEN" && <span className="chip bg-warn-soft text-warn">Yashirilgan (faqat sizga ko‘rinadi)</span>}
        {c.status === "REJECTED" && <span className="chip bg-danger-soft text-danger">Rad etilgan (faqat sizga ko‘rinadi)</span>}
        <span className="text-sm text-ink-muted">
          {c.author} · {new Date(c.createdAt).toLocaleDateString("uz-UZ")}
        </span>
      </div>
      <p className="mt-2 text-lg font-bold">{c.proposal}</p>
      <p className="mt-1 whitespace-pre-line text-ink-soft">{c.explanation}</p>
      {c.example && <p className="mt-2 border-l-2 border-info/40 pl-3 italic text-ink-soft">Misol: {c.example}</p>}
      {c.sourceUrl && (
        <p className="mt-2 text-sm">
          Manba:{" "}
          <a href={c.sourceUrl} target="_blank" rel="nofollow ugc noopener noreferrer" className="break-all underline">
            {c.sourceUrl}
          </a>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted" aria-live="polite">
          Ovozlar: {score}
        </span>
        {loggedIn && !c.mine && (
          <>
            <button type="button" className={`btn btn-sm ${myVote === 1 ? "btn-primary" : "btn-ghost"}`} onClick={() => vote(1)} aria-pressed={myVote === 1}>
              <ThumbsUp className="h-4 w-4" aria-hidden /> Foydali
            </button>
            <button type="button" className={`btn btn-sm ${myVote === -1 ? "btn-primary" : "btn-ghost"}`} onClick={() => vote(-1)} aria-pressed={myVote === -1}>
              <ThumbsDown className="h-4 w-4" aria-hidden /> Foydasiz
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting((v) => !v)} aria-expanded={reporting}>
              <Flag className="h-4 w-4" aria-hidden /> Shikoyat
            </button>
          </>
        )}
        {c.mine && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              if (!confirm("Izohingiz o‘chirilsinmi?")) return;
              try {
                await api(`/api/comments/${c.id}`, { method: "DELETE" });
                toast.success("Izoh o‘chirildi.");
                onChange();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> O‘chirish
          </button>
        )}
      </div>
      {reporting && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`/api/comments/${c.id}/report`, { method: "POST", json: { reason } });
              toast.success("Shikoyatingiz moderatorlarga yuborildi.");
              setReporting(false);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={`reason-${c.id}`} className="text-sm font-semibold">
              Shikoyat sababi
            </label>
            <select id={`reason-${c.id}`} className="field !py-2" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-danger">Yuborish</button>
        </form>
      )}
    </li>
  );
}

export function CommentsSection({ kind, term, data, onChange }: { kind: "LOANWORD" | "IDIOM"; term: string; data: DiscussionDTO; onChange: () => void }) {
  const { data: session } = authClient.useSession();
  const toast = useToast();
  const pathname = usePathname();
  const params = useSearchParams();
  const [proposal, setProposal] = useState("");
  const [explanation, setExplanation] = useState("");
  const [example, setExample] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = `${pathname}?${params.toString()}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!proposal.trim()) return setError("Taklif etilayotgan muqobil yoki ma’noni yozing.");
    if (explanation.trim().length < 10) return setError("Tushuntirish kamida 10 belgidan iborat bo‘lsin.");
    setBusy(true);
    try {
      await api("/api/discussions", { method: "POST", json: { kind, term, proposal, explanation, example, sourceUrl, website } });
      setProposal("");
      setExplanation("");
      setExample("");
      setSourceUrl("");
      toast.success("Izohingiz qo‘shildi. U “Hamjamiyat taklifi” sifatida ko‘rinadi.");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5" aria-labelledby="comments-title">
      <h3 id="comments-title" className="flex items-center gap-2 text-xl font-bold">
        <MessageSquarePlus className="h-5 w-5 text-accent" aria-hidden /> Izohlar
        <span className="chip text-ink-soft">{data.comments.length}</span>
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Izohlar hamjamiyat takliflari hisoblanadi va moderatorlar tekshirmaguncha tasdiqlangan ma’lumot emas. Ovozlar soni yozuvni avtomatik tasdiqlamaydi.
      </p>

      {data.comments.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {data.comments.map((c) => (
            <CommentItem key={c.id} c={c} onChange={onChange} loggedIn={!!session} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-ink-soft">Hozircha izoh yo‘q. Birinchi bo‘lib taklif qoldiring.</p>
      )}

      {session ? (
        <form className="mt-5 flex flex-col gap-4 border-t border-line pt-5" onSubmit={submit} noValidate>
          <p className="font-semibold">“{term}” uchun taklif qoldirish</p>
          <Field label="Taklif etilayotgan muqobil yoki ma’no" htmlFor="c-proposal">
            <input id="c-proposal" className="field" value={proposal} onChange={(e) => setProposal(e.target.value)} maxLength={200} required />
          </Field>
          <Field label="Tushuntirish" htmlFor="c-expl" hint="Nega aynan shu muqobil mos? Qaysi vaziyatda ishlatiladi?">
            <textarea id="c-expl" className="field min-h-28" value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={2000} required />
          </Field>
          <Field label="Misol (ixtiyoriy)" htmlFor="c-example">
            <input id="c-example" className="field" value={example} onChange={(e) => setExample(e.target.value)} maxLength={500} />
          </Field>
          <Field label="Manba havolasi (ixtiyoriy)" htmlFor="c-source" hint="https:// bilan boshlanadigan havola.">
            <input id="c-source" type="url" className="field" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={500} />
          </Field>
          {/* Spam botlar uchun yashirin maydon */}
          <div aria-hidden className="hidden">
            <label htmlFor="c-website">Veb-sayt</label>
            <input id="c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error && <Notice kind="danger">{error}</Notice>}
          <button className="btn btn-primary self-start" disabled={busy}>
            {busy ? "Yuborilmoqda…" : "Izoh qoldirish"}
          </button>
        </form>
      ) : (
        <Notice kind="info" className="mt-5">
          Izoh qoldirish uchun{" "}
          <Link href={`/kirish?next=${encodeURIComponent(next)}`} className="font-semibold underline">
            tizimga kiring
          </Link>{" "}
          yoki{" "}
          <Link href={`/royxat?next=${encodeURIComponent(next)}`} className="font-semibold underline">
            ro‘yxatdan o‘ting
          </Link>
          . Qidiruv uchun ro‘yxatdan o‘tish shart emas.
        </Notice>
      )}
    </section>
  );
}
