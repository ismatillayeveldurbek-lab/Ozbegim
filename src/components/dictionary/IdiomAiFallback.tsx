"use client";
import { useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";

type Result = { found: true; manosi: string; misol: string; manodoshlar: string[]; izoh: string } | { found: false };

/** Bazada yo‘q ibora: tashqi xizmatdan taxminiy izoh (aniq "Taxmin" deb belgilangan). */
export function IdiomAiFallback({ phrase }: { phrase: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    api<{ result: Result }>("/api/ai/idiom", { method: "POST", json: { phrase } })
      .then((d) => alive && setData(d.result))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [phrase]);

  if (loading) return <Spinner label="Ibora ma’nosi aniqlanmoqda…" />;
  if (error || !data || !data.found)
    return (
      <Notice kind="warn" title="Bunday ibora topilmadi">
        “{phrase}” iborasi bazada yo‘q{error ? ` (${error})` : ""}. Yozilishini tekshirib, qayta urinib ko‘ring.
      </Notice>
    );
  return (
    <article className="glass flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold">{phrase}</h3>
        <span className="chip bg-info-soft text-info">Taxmin</span>
      </div>
      <p className="text-lg">{data.manosi}</p>
      {data.misol && (
        <p className="border-l-4 border-accent pl-3 italic text-ink-soft">
          <span className="sr-only">Misol: </span>
          {data.misol}
        </p>
      )}
      {data.manodoshlar.length > 0 && (
        <p className="text-[0.95rem]">
          <strong>Ma’nodoshlar:</strong> {data.manodoshlar.join(", ")}
        </p>
      )}
      {data.izoh && <p className="text-sm text-ink-muted">{data.izoh}</p>}
      <p className="text-sm text-ink-muted">
        Bu ibora hali bazada yo‘q: izoh tashqi xizmatdan olingan taxmin, tasdiqlangan lug‘at ma’lumoti emas. Administrator tekshirgach, bazaga qo‘shiladi.
      </p>
    </article>
  );
}
