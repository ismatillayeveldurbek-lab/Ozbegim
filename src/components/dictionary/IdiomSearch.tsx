"use client";
import { Quote } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, Notice, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/fetcher";
import { IdiomCard } from "./IdiomCard";
import { SearchForm } from "./SearchForm";
import type { IdiomDTO } from "./types";

export function IdiomSearch() {
  const q = useSearchParams().get("q") ?? "";
  const [data, setData] = useState<{ exact: IdiomDTO[]; near: IdiomDTO[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setData(null);
    let alive = true;
    setLoading(true);
    setError(null);
    api<{ exact: IdiomDTO[]; near: IdiomDTO[] }>(`/api/idioms/search?record=1&q=${encodeURIComponent(q)}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-5">
      <SearchForm basePath="/iboralar" initial={q} label="Ibora" placeholder="Masalan: ko‘z ochib yumguncha yoki кўз очиб юмгунча" />
      {loading && <Spinner label="Qidirilmoqda…" />}
      {error && <Notice kind="danger">{error}</Notice>}
      {!q && (
        <EmptyState title="Iborani kiriting" icon={<Quote className="h-10 w-10" aria-hidden />}>
          Lotin yoki kirill yozuvida qidirishingiz mumkin. Katta-kichik harflar va apostrof turlari natijaga ta’sir qilmaydi.
        </EmptyState>
      )}
      {data && !loading && (
        <>
          {data.exact.length > 0 ? (
            <div className="flex flex-col gap-4">
              {data.exact.map((i) => (
                <IdiomCard key={i.id} idiom={i} />
              ))}
            </div>
          ) : (
            <Notice kind="warn" title="Bunday ibora topilmadi">
              “{q}” iborasi bazada yo‘q. Ibora ma’nosi uni tashkil etgan so‘zlarning oddiy ma’nolaridan farq qiladi, shuning uchun taxminiy izoh
              berilmaydi.
            </Notice>
          )}
          {data.near.length > 0 && (
            <section aria-labelledby="near-title">
              <h3 id="near-title" className="mb-3 text-lg font-bold">
                Yaqin natijalar
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.near.map((i) => (
                  <a key={i.id} href={`/iboralar?q=${encodeURIComponent(i.phrase)}`} className="block">
                    <IdiomCard idiom={i} compact />
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
