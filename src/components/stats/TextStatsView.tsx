"use client";
import { useMemo, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { STATS_METHOD, textStats } from "@/lib/uz/stats";

export function TextStatsView() {
  const [text, setText] = useState("");
  const [skip, setSkip] = useState(false);
  const s = useMemo(() => textStats(text, { skipFunctionWords: skip }), [text, skip]);
  const totalScript = s.script.latinWords + s.script.cyrillicWords + s.script.mixedWords;
  const pct = (n: number) => (totalScript ? `${Math.round((n / totalScript) * 100)}%` : "—");
  const tiles = [
    ["Belgilar (bo‘shliqlar bilan)", s.charsWithSpaces],
    ["Belgilar (bo‘shliqlarsiz)", s.charsWithoutSpaces],
    ["So‘zlar", s.words],
    ["Takrorlanmas so‘zlar", s.uniqueWords],
    ["Gaplar", s.sentences],
    ["Paragraflar", s.paragraphs],
    ["So‘zning o‘rtacha uzunligi", s.avgWordLength],
  ] as const;
  const max = s.topWords[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-col gap-2 p-4">
        <label htmlFor="st-text" className="font-semibold">
          Matn
        </label>
        <textarea id="st-text" className="field min-h-48" value={text} onChange={(e) => setText(e.target.value)} placeholder="Matnni joylashtiring — statistika darhol hisoblanadi." spellCheck={false} />
        <p className="text-sm text-ink-muted">Matn brauzeringizda hisoblanadi va serverga yuborilmaydi.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([l, v]) => (
          <li key={l} className="glass p-4">
            <p className="text-sm text-ink-muted">{l}</p>
            <p className="text-2xl font-extrabold tabular-nums">{v.toLocaleString("uz")}</p>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="glass p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Eng ko‘p takrorlangan so‘zlar</h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Yordamchi so‘zlarsiz
            </label>
          </div>
          {s.topWords.length ? (
            <ol className="mt-3 flex flex-col gap-1.5">
              {s.topWords.map((w) => (
                <li key={w.word} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-[0.95rem]">
                  <span className="truncate">{w.word}</span>
                  <span className="h-3 rounded-full bg-accent" style={{ width: `${(w.count / max) * 100}%` }} aria-hidden />
                  <span className="text-right tabular-nums">{w.count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-ink-muted">Matn kiritilmagan.</p>
          )}
        </section>
        <section className="glass p-5">
          <h3 className="text-lg font-bold">Yozuv tarkibi (so‘zlar bo‘yicha)</h3>
          <table className="mt-3 w-full text-left">
            <tbody>
              {[
                ["Lotin", s.script.latinWords],
                ["Kirill", s.script.cyrillicWords],
                ["Aralash (bir so‘zda ikkala yozuv)", s.script.mixedWords],
                ["Faqat raqam yoki boshqa yozuv", s.script.otherWords],
              ].map(([l, v]) => (
                <tr key={l as string} className="border-t border-line">
                  <td className="py-1.5">{l}</td>
                  <td className="text-right tabular-nums">{v}</td>
                  <td className="w-16 text-right text-ink-muted">{l === "Faqat raqam yoki boshqa yozuv" ? "" : pct(v as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.script.mixedList.length > 0 && (
            <Notice kind="warn" className="mt-3" title="Aralash yozuvli so‘zlar">
              {s.script.mixedList.join(", ")}
            </Notice>
          )}
        </section>
      </div>
      <section className="glass p-5">
        <h3 className="text-lg font-bold">Qanday hisoblanadi</h3>
        <ul className="mt-2 list-inside list-disc text-ink-soft">
          {STATS_METHOD.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-muted">Bu sahifa matn sifati yoki savodxonlik darajasini baholamaydi — bunday baholar uchun ilmiy asoslangan mezon yo‘q.</p>
      </section>
    </div>
  );
}
