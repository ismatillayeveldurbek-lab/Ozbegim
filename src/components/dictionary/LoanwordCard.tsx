import { entryBadgeStatus, StatusBadge } from "@/components/ui/primitives";
import { SaveButton } from "./SaveButton";
import { SourceLine } from "./SourceLine";
import type { LoanwordDTO } from "./types";

export function LoanwordCard({ word, compact = false }: { word: LoanwordDTO; compact?: boolean }) {
  return (
    <article className="glass flex flex-col gap-4 p-5 animate-rise">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold">{word.word}</h3>
          <p className="text-sm text-ink-muted">
            O‘zlashma so‘z
            {word.originLanguage ? ` · ${word.originLanguage}` : ""}
            {word.domain ? ` · soha: ${word.domain}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={entryBadgeStatus(word.status, word.origin)} />
          {!compact && <SaveButton kind="LOANWORD" term={word.word} meaning={word.meaning} refId={word.id} />}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="O‘zbekcha muqobil">
          <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">O‘zbekcha muqobil</h4>
          {word.alternatives.length ? (
            <ul className="flex flex-col gap-2">
              {word.alternatives.map((a) => (
                <li key={a.text} className="rounded-xl bg-accent-soft px-3 py-2">
                  <span className="text-lg font-bold text-accent">{a.text}</span>
                  {a.usageNote && <span className="block text-sm text-ink-soft">Qachon ishlatiladi: {a.usageNote}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-3 py-2 text-ink-soft">
              Bazada umumqabul qilingan muqobil ko‘rsatilmagan. So‘zning o‘zi ishlatilishi mumkin.
            </p>
          )}
        </section>
        <section aria-label="Izoh">
          <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">O‘zbekcha ma’nosi (izoh)</h4>
          <p>{word.meaning ?? "Izoh kiritilmagan."}</p>
        </section>
      </div>

      {!compact && (word.examples.length > 0 || word.spellingVariants.length > 0) && (
        <div className="flex flex-col gap-2">
          {word.examples.map((e) => (
            <p key={e} className="border-l-2 border-accent/40 pl-3 italic text-ink-soft">
              <span className="sr-only">Misol: </span>
              {e}
            </p>
          ))}
          {word.spellingVariants.length > 0 && (
            <p className="text-sm text-ink-soft">
              <span className="font-semibold">Muqobil yozilishlar:</span> {word.spellingVariants.join(", ")}
            </p>
          )}
        </div>
      )}
      {!compact && (
        <footer className="border-t border-line pt-3">
          <SourceLine source={word.source} origin={word.origin} />
        </footer>
      )}
    </article>
  );
}
