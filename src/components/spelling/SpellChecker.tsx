"use client";
import { BookPlus, Check, CheckCheck, Columns2, Copy, Download, FileUp, History, Undo2, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { diffWords } from "@/lib/diff";
import { api } from "@/lib/fetcher";
import { downloadText } from "@/lib/text-count";
import { normalizeKey } from "@/lib/uz/normalize";
import { applyAll, applySuggestion, checkSpelling, type Suggestion, TYPE_LABEL } from "@/lib/uz/spelling/check";
import { AiSpelling } from "./AiSpelling";

interface Resources {
  pairs: Array<{ wrongKey: string; correct: string; note: string | null }>;
  ignore: string[];
}

const WORD_TYPES = new Set(["imlo", "o_g_belgisi", "tutuq", "qoshib_yozish", "ajratib_yozish"]);

export function SpellChecker() {
  const toast = useToast();
  const { data: session } = authClient.useSession();
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [punctuation, setPunctuation] = useState(false);
  const [resources, setResources] = useState<Resources>({ pairs: [], ignore: [] });
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Array<{ text: string; rejected: Set<string> }>>([]);
  const [active, setActive] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [debounced, setDebounced] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Resources>("/api/spell/resources").then(setResources).catch(() => {});
  }, [session]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const ignore = useMemo(() => new Set(resources.ignore), [resources.ignore]);
  // Matn o‘zgarganda tavsiyalar qaytadan hisoblanadi (eski indekslar ishlatilmaydi).
  const suggestions = useMemo(
    () => checkSpelling(debounced, { punctuation, ignore, pairs: resources.pairs }).filter((s) => !rejected.has(s.signature)),
    [debounced, punctuation, ignore, resources.pairs, rejected],
  );
  const stale = debounced !== text;

  function pushUndo() {
    setUndo((u) => [...u.slice(-49), { text, rejected }]);
  }

  function accept(s: Suggestion) {
    const next = applySuggestion(text, s);
    if (next === null) {
      toast.info("Matn o‘zgargan — tavsiyalar qayta hisoblandi.");
      return;
    }
    pushUndo();
    setText(next);
    setDebounced(next);
  }

  function reject(s: Suggestion) {
    pushUndo();
    setRejected(new Set([...rejected, s.signature]));
  }

  function acceptAll() {
    const r = applyAll(text, suggestions);
    if (!r.applied) return;
    pushUndo();
    setText(r.text);
    setDebounced(r.text);
    toast.success(`${r.applied} ta tavsiya qabul qilindi.`);
  }

  function doUndo() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo(undo.slice(0, -1));
    setText(last.text);
    setDebounced(last.text);
    setRejected(last.rejected);
  }

  async function addToDictionary(s: Suggestion) {
    const word = s.original.trim();
    try {
      await api("/api/personal/items", { method: "POST", json: { kind: "WORD", term: word, ignoreInSpellcheck: true, note: "Imlo tekshiruvidan qo‘shildi" } });
      setResources((r) => ({ ...r, ignore: [...r.ignore, normalizeKey(word)] }));
      toast.success(`“${word}” shaxsiy lug‘atga qo‘shildi va endi xato deb belgilanmaydi.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function loadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api<{ text: string }>("/api/spell/extract", { method: "POST", body: form });
      pushUndo();
      setText(r.text);
      setOriginal(r.text);
      setRejected(new Set());
      toast.success("Fayldagi matn yuklandi.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveHistory() {
    try {
      await api("/api/history", { method: "POST", json: { type: "spellcheck", summary: `Imlo tekshiruvi: ${suggestions.length} ta tavsiya qoldi`, inputText: original || text, outputText: text, meta: { remaining: suggestions.length } } });
      toast.success("Tarixga saqlandi.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Belgilangan matn: har bir tavsiya joyi rang + to‘lqinli chiziq + raqam bilan ko‘rsatiladi.
  const highlighted = useMemo(() => {
    const parts: Array<{ text: string; s?: Suggestion; n?: number }> = [];
    let pos = 0;
    suggestions.forEach((s, i) => {
      if (s.start > pos) parts.push({ text: debounced.slice(pos, s.start) });
      parts.push({ text: s.original || "⁁", s, n: i + 1 });
      pos = s.end;
    });
    parts.push({ text: debounced.slice(pos) });
    return parts;
  }, [suggestions, debounced]);

  const before = original || undo[0]?.text || "";

  return (
    <div className="flex flex-col gap-4">
      <Notice kind="info" title="Tekshiruv qamrovi">
        Tekshiruv brauzeringizda, qoidalar asosida bajariladi: o‘/g‘ va tutuq belgilari, ko‘p uchraydigan xato yozilishlar, katta harf, qo‘shib/ajratib/chiziqcha bilan
        yozish, bo‘shliqlar va (yoqilsa) tinish belgilari. To‘liq o‘zbek tili lug‘ati ulanmagan, shuning uchun bazada bo‘lmagan so‘zlardagi xatolar aniqlanmasligi
        mumkin. Ism-familiya va atamalar avtomatik xato hisoblanmaydi.
      </Notice>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="glass flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="spell-text" className="font-semibold">
                Matn
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 items-center gap-2 text-[0.95rem]">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={punctuation} onChange={(e) => setPunctuation(e.target.checked)} />
                  Tinish belgilarini ham tekshirish
                </label>
                <input ref={fileRef} type="file" className="sr-only" accept=".txt,.docx,.pptx,.pdf,.csv,.srt,.vtt" onChange={(e) => (e.target.files?.[0] && loadFile(e.target.files[0]), (e.target.value = ""))} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" aria-hidden /> Fayldan olish
                </button>
              </div>
            </div>
            <textarea
              id="spell-text"
              className="field min-h-56"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tekshiriladigan matnni yozing yoki joylashtiring…"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={acceptAll} disabled={!suggestions.length || stale}>
                <CheckCheck className="h-4 w-4" aria-hidden /> Barchasini qabul qilish
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={doUndo} disabled={!undo.length}>
                <Undo2 className="h-4 w-4" aria-hidden /> Ortga qaytarish
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompare((v) => !v)} aria-pressed={compare} disabled={!before}>
                <Columns2 className="h-4 w-4" aria-hidden /> Oldin/keyin
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!text}
                onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Nusxalandi."), () => toast.error("Nusxalab bo‘lmadi."))}
              >
                <Copy className="h-4 w-4" aria-hidden /> Nusxalash
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!text} onClick={() => downloadText("ozbegim-imlo.txt", text)}>
                <Download className="h-4 w-4" aria-hidden /> Yuklab olish
              </button>
              {session && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={!text} onClick={saveHistory}>
                  <History className="h-4 w-4" aria-hidden /> Tarixga saqlash
                </button>
              )}
            </div>
          </div>

          {compare && before && (
            <div className="glass p-4">
              <h3 className="mb-2 font-bold">Oldin / keyin</h3>
              <p className="mb-2 text-sm text-ink-muted">
                <span className="rounded bg-danger-soft px-1 line-through">o‘chirilgan</span> va <span className="rounded bg-accent-soft px-1 underline">qo‘shilgan</span> qismlar.
              </p>
              <p className="whitespace-pre-wrap break-words leading-8">
                {diffWords(before, text).map((p, i) =>
                  p.kind === "same" ? (
                    <Fragment key={i}>{p.text}</Fragment>
                  ) : p.kind === "del" ? (
                    <del key={i} className="rounded bg-danger-soft px-0.5 text-danger">
                      <span className="sr-only">o‘chirildi: </span>
                      {p.text}
                    </del>
                  ) : (
                    <ins key={i} className="rounded bg-accent-soft px-0.5 text-accent">
                      <span className="sr-only">qo‘shildi: </span>
                      {p.text}
                    </ins>
                  ),
                )}
              </p>
            </div>
          )}

          {debounced && (
            <div className="glass p-4">
              <h3 className="mb-2 font-bold">Matnda belgilangan joylar</h3>
              <p className="whitespace-pre-wrap break-words leading-8" aria-describedby="spell-legend">
                {highlighted.map((p, i) =>
                  p.s ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(p.s!.id)}
                      className={`mark-issue ${active === p.s.id ? "mark-issue-active" : ""}`}
                      aria-label={`${p.n}-tavsiya: ${TYPE_LABEL[p.s.type]}, “${p.s.original}” o‘rniga “${p.s.replacement}”`}
                    >
                      {p.text}
                      <sup className="ml-0.5 font-bold text-warn" aria-hidden>
                        {p.n}
                      </sup>
                    </button>
                  ) : (
                    <Fragment key={i}>{p.text}</Fragment>
                  ),
                )}
              </p>
              <p id="spell-legend" className="mt-2 text-sm text-ink-muted">
                Belgilangan joylar to‘lqinli chiziq va raqam bilan ko‘rsatilgan; raqam o‘ngdagi ro‘yxatdagi tavsiyaga mos keladi. “⁁” — belgi qo‘shilishi kerak bo‘lgan joy.
              </p>
            </div>
          )}
        </div>

        <aside aria-labelledby="sugg-title" className="flex flex-col gap-3">
          <h3 id="sugg-title" className="text-lg font-bold">
            Tavsiyalar <span className="chip ml-1 text-ink-soft">{suggestions.length}</span>
          </h3>
          {stale && <p className="text-sm text-ink-muted">Hisoblanmoqda…</p>}
          {!suggestions.length && debounced && !stale && <Notice kind="success">Qoidaviy tekshiruv xato topmadi.</Notice>}
          <ol className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                className={`glass p-3 ${active === s.id ? "ring-2 ring-[var(--focus)]" : ""}`}
                onMouseEnter={() => setActive(s.id)}
              >
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-bold text-warn">{i + 1}.</span>
                  <span className="chip text-ink-soft">{TYPE_LABEL[s.type]}</span>
                  <span className={`chip ${s.confidence === "aniq" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>{s.confidence === "aniq" ? "Aniq qoida" : "Ehtimoliy"}</span>
                  {s.source === "lug‘at" && <span className="chip bg-info-soft text-info">Lug‘at</span>}
                </p>
                <p className="mt-2 break-words text-[1.02rem]">
                  <span className="sr-only">Asl variant: </span>
                  <del className="text-danger">{s.original === "" ? "(bo‘sh)" : s.original.replace(/ /g, "␣")}</del>
                  <span aria-hidden> → </span>
                  <span className="sr-only"> tavsiya: </span>
                  <ins className="font-semibold text-accent no-underline">{s.replacement === "" ? "(o‘chirish)" : s.replacement.replace(/ /g, "␣")}</ins>
                </p>
                <p className="mt-1 text-sm text-ink-soft">{s.message}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => accept(s)} disabled={stale}>
                    <Check className="h-4 w-4" aria-hidden /> Qabul qilish
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => reject(s)}>
                    <X className="h-4 w-4" aria-hidden /> Rad etish
                  </button>
                  {session && WORD_TYPES.has(s.type) && /\p{L}/u.test(s.original) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => addToDictionary(s)} title="Bu so‘z keyingi safar xato deb belgilanmaydi">
                      <BookPlus className="h-4 w-4" aria-hidden /> Lug‘atga
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <AiSpelling text={text} onApply={(next) => (pushUndo(), setText(next), setDebounced(next))} />
        </aside>
      </div>
    </div>
  );
}
