import Link from "next/link";
import { IdiomCard } from "@/components/dictionary/IdiomCard";
import { LoanwordCard } from "@/components/dictionary/LoanwordCard";
import { SearchForm } from "@/components/dictionary/SearchForm";
import { Notice } from "@/components/ui/primitives";
import { searchIdioms, searchLoanwords, serializeIdiom, serializeLoanword } from "@/lib/server/dictionary";

export const metadata = { title: "Qidiruv" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 120);
  const [idioms, loans] = q.trim() ? await Promise.all([searchIdioms(q), searchLoanwords(q)]) : [null, null];
  const nothing = idioms && loans && !idioms.exact.length && !loans.exact && !idioms.near.length && !loans.near.length;
  return (
    <div className="flex flex-col gap-5">
      <SearchForm basePath="/qidiruv" initial={q} label="Iboralar va o‘zlashma so‘zlardan qidirish" placeholder="Ibora yoki so‘z…" />
      {nothing && (
        <Notice kind="warn" title="Hech narsa topilmadi">
          <Link className="underline" href={`/ozlashma?q=${encodeURIComponent(q)}`}>
            O‘zlashma so‘zlar bo‘limida
          </Link>{" "}
          izoh qoldirishingiz mumkin.
        </Notice>
      )}
      {idioms && (idioms.exact.length > 0 || idioms.near.length > 0) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">Iboralar</h3>
          {[...idioms.exact, ...idioms.near].slice(0, 6).map((i) => (
            <Link key={i.id} href={`/iboralar?q=${encodeURIComponent(i.phrase)}`}>
              <IdiomCard idiom={serializeIdiom(i)} compact />
            </Link>
          ))}
        </section>
      )}
      {loans && (loans.exact || loans.near.length > 0) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">O‘zlashma so‘zlar</h3>
          {[...(loans.exact ? [loans.exact] : []), ...loans.near].slice(0, 6).map((w) => (
            <Link key={w.id} href={`/ozlashma?q=${encodeURIComponent(w.word)}`}>
              <LoanwordCard word={serializeLoanword(w)} compact />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
