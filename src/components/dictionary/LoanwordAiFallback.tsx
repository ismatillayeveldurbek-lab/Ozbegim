"use client";
import { useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";

type Result =
  | { found: true; soz: string; manosi: string; kelibChiqishi: string; soha: string; muqobillar: Array<{ soz: string; qachon: string }>; misol: string; izoh: string }
  | { found: false };

/** Bazada yo‘q o‘zlashma so‘z: izoh tashqi xizmatdan olinadi. */
export function LoanwordAiFallback({ word, fallbackMessage }: { word: string; fallbackMessage: string | null }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    api<{ result: Result }>("/api/ai/loanword", { method: "POST", json: { word } })
      .then((d) => alive && setData(d.result))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [word]);

  if (loading) return <Spinner label="So‘z ma’nosi aniqlanmoqda…" />;
  if (error || !data || !data.found)
    return (
      <Notice kind="warn" title="Topilmadi">
        {fallbackMessage ?? `“${word}” so‘zi topilmadi.`}
      </Notice>
    );
  return (
    <article className="glass flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-2xl font-bold">{data.soz}</h3>
        {data.kelibChiqishi && <span className="text-ink-muted">({data.kelibChiqishi})</span>}
        {data.soha && <span className="chip text-ink-soft">{data.soha}</span>}
      </div>
      <p className="text-lg">{data.manosi}</p>
      {data.muqobillar.length > 0 && (
        <section>
          <h4 className="font-bold">O‘zbekcha muqobillari</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {data.muqobillar.map((m) => (
              <li key={m.soz}>
                <strong className="text-accent">{m.soz}</strong>
                {m.qachon && <span className="text-ink-soft"> — {m.qachon}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.misol && (
        <p className="border-l-4 border-accent pl-3 italic text-ink-soft">
          <span className="sr-only">Misol: </span>
          {data.misol}
        </p>
      )}
      {data.izoh && <p className="text-sm text-ink-muted">{data.izoh}</p>}
    </article>
  );
}
