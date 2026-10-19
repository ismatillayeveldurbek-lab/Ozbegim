"use client";
import { ArrowLeftRight, Brackets, Copy, Download, History, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";
import { countText, downloadText } from "@/lib/text-count";
import { APOSTROPHE_STYLES, type ApostropheStyle } from "@/lib/uz/alphabet";
import { DEFAULT_PROTECT, PROTECT_LABELS, type ProtectOptions } from "@/lib/uz/protect";
import { detectScript, type ScriptReport } from "@/lib/uz/script";
import { transliterate, type Direction, type TranslitFlag } from "@/lib/uz/translit";

type DirChoice = "auto" | Direction;
const MAX_CHARS = 2_000_000;
const WORKER_THRESHOLD = 20_000;

interface Result {
  text: string;
  flags: TranslitFlag[];
  flagCount: number;
  protectedCount: number;
  script: ScriptReport;
  direction: Direction;
}

const SCRIPT_LABEL = { latin: "Lotin", cyrillic: "Kirill", mixed: "Aralash", none: "Aniqlanmadi" };

export function TextConverter() {
  const toast = useToast();
  const { data: session } = authClient.useSession();
  const [input, setInput] = useState("");
  const [dir, setDir] = useState<DirChoice>("auto");
  const [apostrophe, setApostrophe] = useState<ApostropheStyle>("typographic");
  const [protect, setProtect] = useState<Required<ProtectOptions>>(DEFAULT_PROTECT);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const effectiveDir = useCallback(
    (text: string): Direction => {
      if (dir !== "auto") return dir;
      const s = detectScript(text);
      return s.cyrillicLetters > s.latinLetters ? "cyr2lat" : "lat2cyr";
    },
    [dir],
  );

  // Katta matnlar uchun Web Worker (interfeys qotib qolmasligi uchun).
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL("../../workers/translit.worker.ts", import.meta.url), { type: "module" });
    } catch {
      workerRef.current = null;
    }
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    const id = ++reqId.current;
    if (!input) {
      setResult(null);
      setBusy(false);
      return;
    }
    const direction = effectiveDir(input);
    const options = { direction, apostrophe, protect };
    const big = input.length > WORKER_THRESHOLD && workerRef.current;
    const timer = setTimeout(
      () => {
        if (big && workerRef.current) {
          setBusy(true);
          const w = workerRef.current;
          const onMsg = (e: MessageEvent) => {
            if (e.data.id !== id) return;
            w.removeEventListener("message", onMsg);
            if (id === reqId.current) {
              setResult({ ...e.data, direction });
              setBusy(false);
            }
          };
          w.addEventListener("message", onMsg);
          w.postMessage({ id, text: input, options });
        } else {
          const r = transliterate(input, options);
          setResult({
            text: r.text,
            flags: r.flags.slice(0, 500),
            flagCount: r.flags.length,
            protectedCount: r.protectedRanges.length,
            script: detectScript(input),
            direction,
          });
        }
      },
      big ? 300 : 80,
    );
    return () => clearTimeout(timer);
  }, [input, apostrophe, protect, effectiveDir]);

  const inCount = useMemo(() => countText(input), [input]);
  const outCount = useMemo(() => countText(result?.text ?? ""), [result]);
  const currentDir = result?.direction ?? (dir === "auto" ? "lat2cyr" : dir);

  function swap() {
    // Natija yo‘qolmaydi: u yangi kiritish matniga aylanadi va teskari yo‘nalishda o‘giriladi.
    const out = result?.text ?? "";
    setDir(currentDir === "lat2cyr" ? "cyr2lat" : "lat2cyr");
    setInput(out);
    toast.info("Yo‘nalish almashtirildi: natija kiritish maydoniga o‘tkazildi.");
  }

  function markSelection() {
    const el = inputRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    if (s === e) {
      toast.info("Avval o‘zgarmasligi kerak bo‘lgan parchani belgilang.");
      return;
    }
    setInput(input.slice(0, s) + "{{" + input.slice(s, e) + "}}" + input.slice(e));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.text ?? "");
      toast.success("Natija nusxalandi.");
    } catch {
      toast.error("Nusxalab bo‘lmadi. Matnni qo‘lda belgilab nusxalang.");
    }
  }

  async function saveHistory() {
    try {
      await api("/api/history", {
        method: "POST",
        json: { type: "convert", summary: currentDir === "lat2cyr" ? "Lotin → kirill" : "Kirill → lotin", inputText: input, outputText: result?.text ?? "", meta: { chars: inCount.chars, direction: currentDir } },
      });
      toast.success("Tarixga saqlandi.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const tooLong = input.length > MAX_CHARS;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dir" className="text-sm font-semibold">
              Yo‘nalish
            </label>
            <select id="dir" className="field !w-auto !py-2.5" value={dir} onChange={(e) => setDir(e.target.value as DirChoice)}>
              <option value="auto">Avtomatik aniqlash</option>
              <option value="lat2cyr">Lotin → Kirill</option>
              <option value="cyr2lat">Kirill → Lotin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="apos" className="text-sm font-semibold">
              Lotin yozuvida o‘ va tutuq
            </label>
            <select id="apos" className="field !w-auto !py-2.5" value={apostrophe} onChange={(e) => setApostrophe(e.target.value as ApostropheStyle)}>
              {Object.entries(APOSTROPHE_STYLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-ghost" onClick={swap} disabled={!result}>
            <ArrowLeftRight className="h-4 w-4" aria-hidden /> Yo‘nalishni almashtirish
          </button>
        </div>
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="mb-1.5 text-sm font-semibold">O‘zgarmaydigan parchalar</legend>
          {(Object.keys(PROTECT_LABELS) as Array<keyof typeof PROTECT_LABELS>).map((k) => {
            const key = (k === "url" ? "urls" : k === "email" ? "emails" : k === "formula" ? "formulas" : k === "marker" ? "markers" : "code") as keyof ProtectOptions;
            return (
              <label key={k} className="inline-flex min-h-11 items-center gap-2">
                <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={protect[key]} onChange={(e) => setProtect({ ...protect, [key]: e.target.checked })} />
                {k === "marker" ? "Belgilangan {{parchalar}}" : PROTECT_LABELS[k] + (k === "url" ? "lar" : "")}
              </label>
            );
          })}
        </fieldset>
      </div>

      {result && result.script.kind !== "none" && (
        <div aria-live="polite">
          {result.script.kind === "mixed" || result.script.mixedWords.length ? (
            <Notice kind="warn" title={`Yozuv: ${SCRIPT_LABEL[result.script.kind]}`}>
              {result.script.explanation}
            </Notice>
          ) : (
            <p className="text-sm text-ink-muted">
              Aniqlangan yozuv: <strong className="text-ink">{SCRIPT_LABEL[result.script.kind]}</strong>. Yo‘nalish:{" "}
              <strong className="text-ink">{currentDir === "lat2cyr" ? "Lotin → Kirill" : "Kirill → Lotin"}</strong>
              {dir === "auto" ? " (avtomatik)" : ""}.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="src" className="font-semibold">
              Asl matn
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={markSelection} title="Belgilangan parchani {{ }} ichiga oladi">
              <Brackets className="h-4 w-4" aria-hidden /> Parchani himoyalash
            </button>
          </div>
          <textarea
            id="src"
            ref={inputRef}
            className="field min-h-64 flex-1 resize-y lg:min-h-80"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Matnni shu yerga yozing yoki joylashtiring…"
            spellCheck={false}
          />
          <p className="text-sm text-ink-muted" aria-live="polite">
            {inCount.chars.toLocaleString("uz")} belgi · {inCount.words.toLocaleString("uz")} so‘z
          </p>
          {tooLong && <Notice kind="warn">Matn juda katta (2 mln belgidan ortiq). Uni fayl sifatida o‘girish tavsiya etiladi.</Notice>}
        </div>

        <div className="glass flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="out" className="font-semibold">
              Natija
            </label>
            {busy && <span className="text-sm text-ink-muted">O‘girilmoqda…</span>}
          </div>
          <textarea id="out" className="field min-h-64 flex-1 resize-y lg:min-h-80" value={result?.text ?? ""} readOnly placeholder="Natija shu yerda chiqadi." />
          <p className="text-sm text-ink-muted">
            {outCount.chars.toLocaleString("uz")} belgi · {outCount.words.toLocaleString("uz")} so‘z
            {result?.protectedCount ? ` · ${result.protectedCount} ta himoyalangan parcha` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={copy} disabled={!result?.text}>
              <Copy className="h-4 w-4" aria-hidden /> Nusxalash
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadText(currentDir === "lat2cyr" ? "ozbegim-kirill.txt" : "ozbegim-lotin.txt", result?.text ?? "")}
              disabled={!result?.text}
            >
              <Download className="h-4 w-4" aria-hidden /> Yuklab olish
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setInput("")} disabled={!input}>
              <Trash2 className="h-4 w-4" aria-hidden /> Tozalash
            </button>
            {session && (
              <button type="button" className="btn btn-ghost" onClick={saveHistory} disabled={!result?.text}>
                <History className="h-4 w-4" aria-hidden /> Tarixga saqlash
              </button>
            )}
          </div>
        </div>
      </div>

      {result && result.flagCount > 0 && (
        <section className="glass p-4 sm:p-5" aria-labelledby="flags-title">
          <h3 id="flags-title" className="text-lg font-bold">
            Tekshirish tavsiya etiladi <span className="chip ml-1 bg-warn-soft text-warn">{result.flagCount}</span>
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Transliteratsiya har doim ham bir ma’noli emas. Quyidagi so‘zlarni natijada ko‘zdan kechiring.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {result.flags.slice(0, 100).map((f) => (
              <li key={`${f.start}-${f.reason}`} className="rounded-xl border border-line px-3 py-2">
                <span className="font-semibold">“{f.word}”</span> <span className="text-sm text-ink-soft">— {f.message}</span>
              </li>
            ))}
          </ul>
          {result.flagCount > 100 && <p className="mt-2 text-sm text-ink-muted">Yana {result.flagCount - 100} ta holat ko‘rsatilmadi.</p>}
        </section>
      )}
    </div>
  );
}
