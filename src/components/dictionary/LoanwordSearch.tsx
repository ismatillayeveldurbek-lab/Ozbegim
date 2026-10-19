"use client";
import { Replace } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Notice, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";
import { CommentsSection } from "./CommentsSection";
import { LoanwordCard } from "./LoanwordCard";
import { SearchForm } from "./SearchForm";
import type { DiscussionDTO, LoanwordDTO } from "./types";

interface Resp {
  exact: LoanwordDTO | null;
  near: LoanwordDTO[];
  notFoundMessage: string | null;
  discussion: DiscussionDTO;
}

export function LoanwordSearch() {
  const q = useSearchParams().get("q") ?? "";
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (record: boolean) => {
      if (!q.trim()) return setData(null);
      try {
        setError(null);
        setData(await api<Resp>(`/api/loanwords/search?${record ? "record=1&" : ""}q=${encodeURIComponent(q)}`));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [q],
  );

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <SearchForm basePath="/ozlashma" initial={q} label="O‘zlashma so‘z" placeholder="Masalan: prezentatsiya, dedlayn, монитиринг" />
      {loading && <Spinner label="Qidirilmoqda…" />}
      {error && <Notice kind="danger">{error}</Notice>}
      {!q && (
        <EmptyState title="So‘zni kiriting" icon={<Replace className="h-10 w-10" aria-hidden />}>
          O‘zlashma so‘zni yoki uning o‘zbekcha muqobilini yozing. Avval asosiy bazadan qidiriladi.
        </EmptyState>
      )}
      {data && !loading && (
        <>
          {data.exact ? (
            <LoanwordCard word={data.exact} />
          ) : (
            <Notice kind="warn" title="Topilmadi">
              {data.notFoundMessage}
            </Notice>
          )}
          {data.near.length > 0 && (
            <section aria-labelledby="near-title">
              <h3 id="near-title" className="mb-3 text-lg font-bold">
                Yaqin natijalar
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.near.map((w) => (
                  <a key={w.id} href={`/ozlashma?q=${encodeURIComponent(w.word)}`} className="block">
                    <LoanwordCard word={w} compact />
                  </a>
                ))}
              </div>
            </section>
          )}
          <CommentsSection kind="LOANWORD" term={data.exact?.word ?? q.trim()} data={data.discussion} onChange={() => load(false)} />
        </>
      )}
    </div>
  );
}
