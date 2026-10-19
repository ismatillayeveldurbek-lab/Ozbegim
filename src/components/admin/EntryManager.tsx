"use client";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { entryBadgeStatus, Notice, Spinner, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

type EntryType = "idiom" | "loanword" | "lexeme" | "spelling";
const TYPE_LABEL: Record<EntryType, string> = { idiom: "Iboralar", loanword: "O‘zlashma so‘zlar", lexeme: "So‘z tahlili lug‘ati", spelling: "Imlo juftliklari" };
const POS = ["ot", "sifat", "son", "olmosh", "fe’l", "ravish", "ko‘makchi", "bog‘lovchi", "yuklama", "undov", "modal", "taqlid"];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const splitList = (s: string, sep: RegExp = /,/) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

function emptyForm(type: EntryType): Row {
  const base = { status: "PENDING", origin: "OFFICIAL" };
  switch (type) {
    case "idiom":
      return { ...base, phrase: "", tags: "", sourceTitle: "", sourceAuthor: "", sourceUrl: "", sourceYear: "", senses: [{ meaning: "", example: "", synonyms: "" }] };
    case "loanword":
      return { ...base, word: "", meaning: "", domain: "", originLanguage: "", spellingVariants: "", tags: "", examples: "", alternatives: [{ text: "", usageNote: "" }], sourceTitle: "", sourceAuthor: "", sourceUrl: "", sourceYear: "" };
    case "lexeme":
      return { ...base, lemma: "", pos: "ot", meaning: "", examples: "" };
    case "spelling":
      return { ...base, wrong: "", correct: "", note: "" };
  }
}

function toForm(type: EntryType, r: Row): Row {
  const src = r.source ?? {};
  const s = { sourceTitle: src.title ?? "", sourceAuthor: src.author ?? "", sourceUrl: src.url ?? "", sourceYear: src.year ? String(src.year) : "" };
  switch (type) {
    case "idiom":
      return { ...s, status: r.status, origin: r.origin, phrase: r.phrase, tags: r.tags.join(", "), senses: r.senses.map((x: Row) => ({ meaning: x.meaning, example: x.example ?? "", synonyms: x.synonyms.join(", ") })) };
    case "loanword":
      return {
        ...s,
        status: r.status,
        origin: r.origin,
        word: r.word,
        meaning: r.meaning ?? "",
        domain: r.domain ?? "",
        originLanguage: r.originLanguage ?? "",
        spellingVariants: r.spellingVariants.join(", "),
        tags: r.tags.join(", "),
        examples: r.examples.map((e: Row) => e.text).join("\n"),
        alternatives: r.alternatives.length ? r.alternatives.map((a: Row) => ({ text: a.text, usageNote: a.usageNote ?? "" })) : [{ text: "", usageNote: "" }],
      };
    case "lexeme":
      return { status: r.status, origin: r.origin, lemma: r.lemma, pos: r.pos, meaning: r.meaning ?? "", examples: r.examples.join("\n") };
    case "spelling":
      return { status: r.status, origin: r.origin, wrong: r.wrong, correct: r.correct, note: r.note ?? "" };
  }
}

function toPayload(type: EntryType, f: Row) {
  const source = f.sourceTitle?.trim()
    ? { title: f.sourceTitle.trim(), author: f.sourceAuthor || null, url: f.sourceUrl || null, year: f.sourceYear ? Number(f.sourceYear) : null }
    : null;
  const base = { status: f.status, origin: f.origin };
  switch (type) {
    case "idiom":
      return {
        ...base,
        phrase: f.phrase,
        tags: splitList(f.tags),
        source,
        senses: f.senses.filter((s: Row) => s.meaning.trim()).map((s: Row) => ({ meaning: s.meaning, example: s.example || null, synonyms: splitList(s.synonyms) })),
      };
    case "loanword":
      return {
        ...base,
        word: f.word,
        meaning: f.meaning || null,
        domain: f.domain || null,
        originLanguage: f.originLanguage || null,
        spellingVariants: splitList(f.spellingVariants),
        tags: splitList(f.tags),
        source,
        alternatives: f.alternatives.filter((a: Row) => a.text.trim()).map((a: Row) => ({ text: a.text, usageNote: a.usageNote || null })),
        examples: splitList(f.examples, /\n/),
      };
    case "lexeme":
      return { ...base, lemma: f.lemma, pos: f.pos, meaning: f.meaning || null, examples: splitList(f.examples, /\n/) };
    case "spelling":
      return { ...base, wrong: f.wrong, correct: f.correct, note: f.note || null };
  }
}

function title(type: EntryType, r: Row) {
  return type === "idiom" ? r.phrase : type === "loanword" ? r.word : type === "lexeme" ? `${r.lemma} (${r.pos})` : `${r.wrong} → ${r.correct}`;
}
function subtitle(type: EntryType, r: Row) {
  if (type === "idiom") return r.senses.map((s: Row) => s.meaning).join(" · ");
  if (type === "loanword") return [r.alternatives.map((a: Row) => a.text).join(", ") || "muqobilsiz", r.meaning].filter(Boolean).join(" — ");
  if (type === "lexeme") return r.meaning ?? "";
  return r.note ?? "";
}

function Input({ id, label, value, onChange, textarea, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; textarea?: boolean } & Row) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {textarea ? (
        <textarea id={id} className="field min-h-20" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      ) : (
        <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </div>
  );
}

function Editor({ type, initial, id, onDone }: { type: EntryType; initial: Row; id?: string; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState<Row>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(id ? `/api/admin/entries/${type}/${id}` : `/api/admin/entries/${type}`, { method: id ? "PATCH" : "POST", json: toPayload(type, f) });
      toast.success(id ? "Yozuv yangilandi." : "Yozuv qo‘shildi.");
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sourceFields = (type === "idiom" || type === "loanword") && (
    <fieldset className="grid grid-cols-1 gap-3 rounded-2xl border border-line p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Manba</legend>
      <Input id="sT" label="Nomi" value={f.sourceTitle} onChange={set("sourceTitle")} maxLength={300} />
      <Input id="sA" label="Muallif" value={f.sourceAuthor} onChange={set("sourceAuthor")} maxLength={200} />
      <Input id="sU" label="Havola" value={f.sourceUrl} onChange={set("sourceUrl")} maxLength={500} type="url" />
      <Input id="sY" label="Yil" value={f.sourceYear} onChange={set("sourceYear")} inputMode="numeric" />
    </fieldset>
  );

  return (
    <form onSubmit={save} className="glass glass-strong flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{id ? "Yozuvni tahrirlash" : "Yangi yozuv"}</h3>
        <button type="button" className="btn btn-ghost h-10 w-10 !p-0" onClick={() => onDone(false)} aria-label="Yopish">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="st" className="text-sm font-semibold">
            Tekshirilganlik holati
          </label>
          <select id="st" className="field" value={f.status} onChange={(e) => set("status")(e.target.value)}>
            <option value="PENDING">Tekshirilmoqda</option>
            <option value="VERIFIED">Tasdiqlangan</option>
            <option value="REJECTED">Rad etilgan</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="og" className="text-sm font-semibold">
            Kelib chiqishi
          </label>
          <select id="og" className="field" value={f.origin} onChange={(e) => set("origin")(e.target.value)}>
            <option value="OFFICIAL">Asosiy baza</option>
            <option value="COMMUNITY">Hamjamiyat taklifi</option>
            <option value="DEMO">Namuna</option>
          </select>
        </div>
      </div>

      {type === "idiom" && (
        <>
          <Input id="ph" label="Ibora" value={f.phrase} onChange={set("phrase")} required maxLength={200} />
          {f.senses.map((s: Row, i: number) => (
            <fieldset key={i} className="flex flex-col gap-2 rounded-2xl border border-line p-3">
              <legend className="px-1 text-sm font-semibold">{i + 1}-ma’no</legend>
              <Input id={`m${i}`} label="Ma’nosi" textarea value={s.meaning} onChange={(v) => setF((x) => ({ ...x, senses: x.senses.map((y: Row, j: number) => (j === i ? { ...y, meaning: v } : y)) }))} />
              <Input id={`e${i}`} label="Misol" value={s.example} onChange={(v) => setF((x) => ({ ...x, senses: x.senses.map((y: Row, j: number) => (j === i ? { ...y, example: v } : y)) }))} />
              <Input id={`y${i}`} label="Ma’nodosh iboralar (vergul bilan)" value={s.synonyms} onChange={(v) => setF((x) => ({ ...x, senses: x.senses.map((y: Row, j: number) => (j === i ? { ...y, synonyms: v } : y)) }))} />
              {f.senses.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setF((x) => ({ ...x, senses: x.senses.filter((_: Row, j: number) => j !== i) }))}>
                  Ma’noni olib tashlash
                </button>
              )}
            </fieldset>
          ))}
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setF((x) => ({ ...x, senses: [...x.senses, { meaning: "", example: "", synonyms: "" }] }))}>
            <Plus className="h-4 w-4" aria-hidden /> Yana ma’no qo‘shish
          </button>
          <Input id="tg" label="Teglar (vergul bilan)" value={f.tags} onChange={set("tags")} />
          {sourceFields}
        </>
      )}

      {type === "loanword" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input id="w" label="O‘zlashma so‘z" value={f.word} onChange={set("word")} required maxLength={120} />
            <Input id="dm" label="Qo‘llanish sohasi" value={f.domain} onChange={set("domain")} maxLength={120} />
            <Input id="ol" label="Kelib chiqish tili" value={f.originLanguage} onChange={set("originLanguage")} maxLength={120} />
            <Input id="sv" label="Muqobil yozilishlar (vergul bilan)" value={f.spellingVariants} onChange={set("spellingVariants")} />
          </div>
          <Input id="mn" label="O‘zbekcha ma’nosi (izoh)" textarea value={f.meaning} onChange={set("meaning")} maxLength={2000} />
          {f.alternatives.map((a: Row, i: number) => (
            <fieldset key={i} className="grid grid-cols-1 gap-2 rounded-2xl border border-line p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">{i + 1}-muqobil</legend>
              <Input id={`at${i}`} label="Muqobil" value={a.text} onChange={(v) => setF((x) => ({ ...x, alternatives: x.alternatives.map((y: Row, j: number) => (j === i ? { ...y, text: v } : y)) }))} />
              <Input id={`au${i}`} label="Qo‘llanish vaziyati" value={a.usageNote} onChange={(v) => setF((x) => ({ ...x, alternatives: x.alternatives.map((y: Row, j: number) => (j === i ? { ...y, usageNote: v } : y)) }))} />
            </fieldset>
          ))}
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setF((x) => ({ ...x, alternatives: [...x.alternatives, { text: "", usageNote: "" }] }))}>
            <Plus className="h-4 w-4" aria-hidden /> Muqobil qo‘shish
          </button>
          <p className="-mt-2 text-sm text-ink-muted">Muqobil bo‘lmasa, maydonni bo‘sh qoldiring — har bir so‘zning muqobili bo‘lishi shart emas.</p>
          <Input id="ex" label="Misollar (har biri yangi qatorda)" textarea value={f.examples} onChange={set("examples")} />
          <Input id="tg" label="Teglar (vergul bilan)" value={f.tags} onChange={set("tags")} />
          {sourceFields}
        </>
      )}

      {type === "lexeme" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input id="lm" label="So‘z (o‘zak/lemma)" value={f.lemma} onChange={set("lemma")} required maxLength={80} />
            <div className="flex flex-col gap-1">
              <label htmlFor="pos" className="text-sm font-semibold">
                So‘z turkumi
              </label>
              <select id="pos" className="field" value={f.pos} onChange={(e) => set("pos")(e.target.value)}>
                {POS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <Input id="mn" label="Lug‘aviy ma’nosi" textarea value={f.meaning} onChange={set("meaning")} />
          <Input id="ex" label="Misollar (har biri yangi qatorda)" textarea value={f.examples} onChange={set("examples")} />
        </>
      )}

      {type === "spelling" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input id="wr" label="Xato yozilish" value={f.wrong} onChange={set("wrong")} required maxLength={80} />
          <Input id="co" label="To‘g‘ri yozilish" value={f.correct} onChange={set("correct")} required maxLength={80} />
          <div className="sm:col-span-2">
            <Input id="nt" label="Izoh" value={f.note} onChange={set("note")} maxLength={500} />
          </div>
        </div>
      )}

      {error && <Notice kind="danger">{error}</Notice>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

export function EntryManager() {
  const [type, setType] = useState<EntryType>("idiom");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; initial: Row } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ q, status, origin, page: String(page) });
      setData(await api(`/api/admin/entries/${type}?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [type, q, status, origin, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap gap-1 p-1.5" role="tablist" aria-label="Yozuv turi">
        {(Object.keys(TYPE_LABEL) as EntryType[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            type="button"
            className={`rounded-xl px-3.5 py-2 font-semibold ${type === t ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft"}`}
            onClick={() => {
              setType(t);
              setPage(1);
              setEditing(null);
            }}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="aq" className="text-sm font-semibold">
            Qidirish
          </label>
          <input id="aq" className="field" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="as" className="text-sm font-semibold">
            Holat
          </label>
          <select id="as" className="field" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">Barchasi</option>
            <option value="VERIFIED">Tasdiqlangan</option>
            <option value="PENDING">Tekshirilmoqda</option>
            <option value="REJECTED">Rad etilgan</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ao" className="text-sm font-semibold">
            Kelib chiqishi
          </label>
          <select id="ao" className="field" value={origin} onChange={(e) => (setOrigin(e.target.value), setPage(1))}>
            <option value="">Barchasi</option>
            <option value="OFFICIAL">Asosiy baza</option>
            <option value="COMMUNITY">Hamjamiyat</option>
            <option value="DEMO">Namuna</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ initial: emptyForm(type) })}>
          <Plus className="h-4 w-4" aria-hidden /> Yangi yozuv
        </button>
      </div>

      {editing && (
        <Editor
          key={editing.id ?? "new"}
          type={type}
          id={editing.id}
          initial={editing.initial}
          onDone={(saved) => {
            setEditing(null);
            if (saved) load();
          }}
        />
      )}

      {error && <Notice kind="danger">{error}</Notice>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <p className="text-sm text-ink-muted">Jami: {data.total}</p>
          <ul className="flex flex-col gap-2">
            {data.items.map((r) => (
              <li key={r.id} className="glass flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{title(type, r)}</p>
                  <p className="truncate text-sm text-ink-soft">{subtitle(type, r)}</p>
                </div>
                <StatusBadge status={entryBadgeStatus(r.status, r.origin)} />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: r.id, initial: toForm(type, r) })}>
                    <Pencil className="h-4 w-4" aria-hidden /> Tahrirlash
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (!confirm(`“${title(type, r)}” o‘chirilsinmi? Bu amalni ortga qaytarib bo‘lmaydi.`)) return;
                      try {
                        await api(`/api/admin/entries/${type}/${r.id}`, { method: "DELETE" });
                        toast.success("O‘chirildi.");
                        load();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> O‘chirish
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {data.total > data.pageSize && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Oldingi
              </button>
              <span className="text-sm">
                {page} / {Math.ceil(data.total / data.pageSize)}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>
                Keyingi
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
