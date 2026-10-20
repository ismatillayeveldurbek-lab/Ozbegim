"use client";
import { ArrowLeftRight, BookOpen, Equal, Quote, Search, Tag } from "lucide-react";
import { useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";

type Result =
  | { found: true; manosi: string; sinonimlar: string[]; antonimlar: string[]; misollar: string[]; turkum: string }
  | { found: false; xato: string };

export function WordAnalyzer() {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ word: string; result: Result } | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!word.trim()) {
      setData(null);
      setError("Iltimos, so‘z kiriting");
      return;
    }
    setBusy(true);
    try {
      setData(await api<{ word: string; result: Result }>("/api/ai/word-analyzer", { method: "POST", json: { word } }));
    } catch (err) {
      setData(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = data?.result;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={analyze} className="glass flex flex-col gap-2 p-4 sm:p-5" noValidate>
        <label htmlFor="word-analyzer-input" className="font-semibold">
          So‘z
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="word-analyzer-input"
            className="field !text-lg"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="So‘z kiriting..."
            maxLength={60}
            autoComplete="off"
            aria-describedby="word-analyzer-note"
            aria-invalid={error === "Iltimos, so‘z kiriting" || undefined}
          />
          <button className="btn btn-primary !min-h-12 sm:w-44" disabled={busy}>
            <Search className="h-5 w-5" aria-hidden /> Tahlil qilish
          </button>
        </div>
        <p id="word-analyzer-note" className="text-sm text-ink-muted">
          So‘z tahlil uchun AI xizmatiga (Anthropic Claude) yuboriladi. Natija AI taxmini bo‘lib, tasdiqlangan lug‘at ma’lumoti emas.
        </p>
      </form>

      <div aria-live="polite">
        {busy && <Spinner label="Tahlil qilinmoqda..." />}
        {!busy && error && <Notice kind={error.includes("ulanmagan") ? "warn" : "danger"}>{error.includes("ulanmagan") ? "AI xizmati ulanmagan — so‘z tahlilchisi hozircha ishlamaydi." : error}</Notice>}
        {!busy && r && !r.found && (
          <Notice kind="warn" title="So‘z topilmadi">
            “{data!.word}” so‘zi bo‘yicha ma’lumot topilmadi. Yozilishini tekshirib, qayta urinib ko‘ring.
          </Notice>
        )}
      </div>

      {!busy && r?.found && (
        <section aria-labelledby="word-analyzer-title" className="flex flex-col gap-3 animate-rise">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="word-analyzer-title" className="text-2xl font-bold">
              {data!.word}
            </h3>
            <span className="chip bg-info-soft text-info">AI taxmini</span>
          </div>
          <div className="word-analyzer-grid">
            <article className="glass word-analyzer-block word-analyzer-block-wide p-5">
              <h4 className="word-analyzer-label">
                <BookOpen className="h-4 w-4" aria-hidden /> Ma’nosi
              </h4>
              <p className="text-[1.05rem]">{r.manosi}</p>
            </article>
            <article className="glass word-analyzer-block p-5">
              <h4 className="word-analyzer-label">
                <Equal className="h-4 w-4" aria-hidden /> Sinonimlari
              </h4>
              {r.sinonimlar.length ? (
                <ul className="word-analyzer-tags">
                  {r.sinonimlar.map((s) => (
                    <li key={s} className="word-analyzer-tag">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">Sinonimi topilmadi</p>
              )}
            </article>
            <article className="glass word-analyzer-block p-5">
              <h4 className="word-analyzer-label">
                <ArrowLeftRight className="h-4 w-4" aria-hidden /> Antonimlari
              </h4>
              {r.antonimlar.length ? (
                <ul className="word-analyzer-tags">
                  {r.antonimlar.map((s) => (
                    <li key={s} className="word-analyzer-tag word-analyzer-tag-opposite">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">Antonimi mavjud emas</p>
              )}
            </article>
            <article className="glass word-analyzer-block p-5">
              <h4 className="word-analyzer-label">
                <Quote className="h-4 w-4" aria-hidden /> Misol
              </h4>
              {r.misollar.length ? r.misollar.map((m) => <p key={m} className="word-analyzer-example">{m}</p>) : <p className="text-ink-soft">Misol berilmagan</p>}
            </article>
            <article className="glass word-analyzer-block p-5">
              <h4 className="word-analyzer-label">
                <Tag className="h-4 w-4" aria-hidden /> So‘z turkumi
              </h4>
              <p className="word-analyzer-pos">{r.turkum}</p>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}
