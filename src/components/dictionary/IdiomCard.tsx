import { entryBadgeStatus, StatusBadge } from "@/components/ui/primitives";
import { SaveButton } from "./SaveButton";
import { SourceLine } from "./SourceLine";
import type { IdiomDTO } from "./types";

export function IdiomCard({ idiom, compact = false }: { idiom: IdiomDTO; compact?: boolean }) {
  return (
    <article className="glass flex flex-col gap-3 p-5 animate-rise">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-bold">{idiom.phrase}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={entryBadgeStatus(idiom.status, idiom.origin)} />
          {!compact && <SaveButton kind="IDIOM" term={idiom.phrase} meaning={idiom.senses[0]?.meaning} refId={idiom.id} />}
        </div>
      </header>
      <ol className="flex flex-col gap-3">
        {idiom.senses.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            {idiom.senses.length > 1 && (
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent" aria-label={`${i + 1}-ma’no`}>
                {i + 1}
              </span>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-[1.05rem]">
                <span className="sr-only">Ma’nosi: </span>
                {s.meaning}
              </p>
              {s.example && !compact && (
                <p className="border-l-2 border-accent/40 pl-3 italic text-ink-soft">
                  <span className="sr-only">Misol: </span>
                  {s.example}
                </p>
              )}
              {s.synonyms.length > 0 && !compact && (
                <p className="text-sm text-ink-soft">
                  <span className="font-semibold">Ma’nodosh:</span> {s.synonyms.join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!compact && (
        <footer className="flex flex-col gap-1.5 border-t border-line pt-3">
          {idiom.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {idiom.tags.map((t) => (
                <span key={t} className="chip text-ink-soft">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <SourceLine source={idiom.source} origin={idiom.origin} />
        </footer>
      )}
    </article>
  );
}
