"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchForm({ basePath, initial, label, placeholder }: { basePath: string; initial: string; label: string; placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  return (
    <form
      role="search"
      className="glass flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `${basePath}?q=${encodeURIComponent(v)}` : basePath);
      }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="dict-q" className="font-semibold">
          {label}
        </label>
        <input id="dict-q" type="search" className="field !text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} maxLength={120} autoComplete="off" />
      </div>
      <button className="btn btn-primary !min-h-12 sm:w-36">
        <Search className="h-5 w-5" aria-hidden /> Qidirish
      </button>
    </form>
  );
}
