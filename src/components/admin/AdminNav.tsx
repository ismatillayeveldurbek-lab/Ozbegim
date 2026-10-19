"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Umumiy", admin: false },
  { href: "/admin/lugat", label: "Lug‘at yozuvlari", admin: true },
  { href: "/admin/izohlar", label: "Izohlar", admin: false },
  { href: "/admin/shikoyatlar", label: "Shikoyatlar", admin: false },
  { href: "/admin/import", label: "Import", admin: true },
  { href: "/admin/eksport", label: "Eksport va zaxira", admin: true },
  { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar", admin: true },
  { href: "/admin/audit", label: "Audit jurnali", admin: true },
];

export function AdminNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin bo‘limlari" className="glass -mx-1 flex gap-1 overflow-x-auto p-1.5">
      {ITEMS.filter((i) => admin || !i.admin).map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[0.95rem] font-semibold ${active ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
