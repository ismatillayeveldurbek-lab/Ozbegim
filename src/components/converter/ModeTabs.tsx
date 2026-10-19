import Link from "next/link";

export function ModeTabs({ active }: { active: "text" | "file" }) {
  const cls = (on: boolean) =>
    `flex-1 rounded-xl px-4 py-2.5 text-center font-semibold sm:flex-none ${on ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft"}`;
  return (
    <nav aria-label="Konvertor rejimi" className="glass mb-5 flex w-full gap-1 p-1.5 sm:w-fit">
      <Link href="/konvertor" className={cls(active === "text")} aria-current={active === "text" ? "page" : undefined}>
        A. Matnni o‘girish
      </Link>
      <Link href="/konvertor/fayl" className={cls(active === "file")} aria-current={active === "file" ? "page" : undefined}>
        B. Faylni o‘girish
      </Link>
    </nav>
  );
}
