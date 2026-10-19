"use client";
import { Ellipsis, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { authClient } from "@/lib/auth-client";
import { ADMIN_NAV, EXTRA_NAV, HOME_NAV, MAIN_NAV, titleFor, type NavItem } from "@/lib/nav";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function SideLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.975rem] font-medium transition-colors ${
        active ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft hover:text-ink"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function GlobalSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/qidiruv?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="global-search" className="sr-only">
        Iboralar va o‘zlashma so‘zlardan qidirish
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ibora yoki so‘zni qidiring…"
        className="field !rounded-full !py-2.5 !pl-10"
        maxLength={120}
      />
    </form>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data } = authClient.useSession();
  const role = (data?.user as { role?: string } | undefined)?.role;
  const staff = role === "admin" || role === "moderator";
  const title = titleFor(pathname);

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreItems = [...EXTRA_NAV, ...(staff ? [ADMIN_NAV] : [])];
  const moreActive = moreItems.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[100] btn btn-primary">
        Asosiy mazmunga o‘tish
      </a>
      <div className="app-backdrop" aria-hidden />

      {/* Kompyuter: chap navigatsiya */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col p-4 lg:flex" aria-label="Asosiy navigatsiya">
        <div className="glass flex h-full flex-col gap-1 overflow-y-auto p-4">
          <Link href="/" className="mb-5 rounded-2xl p-1">
            <Logo />
          </Link>
          <SideLink item={HOME_NAV} pathname={pathname} />
          <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Asosiy vositalar</p>
          {MAIN_NAV.map((i) => (
            <SideLink key={i.href} item={i} pathname={pathname} />
          ))}
          <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Qo‘shimcha</p>
          {EXTRA_NAV.map((i) => (
            <SideLink key={i.href} item={i} pathname={pathname} />
          ))}
          {staff && (
            <>
              <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Boshqaruv</p>
              <SideLink item={ADMIN_NAV} pathname={pathname} />
            </>
          )}
        </div>
      </aside>

      <div className="lg:pl-72">
        {/* Yuqori panel */}
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4 lg:px-6 lg:pt-4">
          <div className="glass flex items-center gap-3 px-3 py-2 sm:px-4 lg:py-3">
            <Link href="/" className="lg:hidden" aria-label="Bosh sahifa">
              <Logo compact />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold sm:text-xl">{title}</h1>
            <GlobalSearch className="hidden w-80 md:block" />
            <Link href="/qidiruv" className="btn btn-ghost h-11 w-11 !p-0 md:hidden" aria-label="Qidiruv">
              <Search className="h-5 w-5" aria-hidden />
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-4 lg:px-6 lg:pb-12 lg:pt-6">
          {children}
        </main>
      </div>

      {/* Telefon: pastki navigatsiya — asosiy 4 bo‘lim + "Yana" */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Asosiy bo‘limlar">
        <ul className="glass glass-strong grid grid-cols-5 gap-1 p-1.5">
          {MAIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.72rem] font-semibold ${
                    active ? "bg-accent text-accent-ink" : "text-ink-soft"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.72rem] font-semibold ${
                moreActive ? "bg-accent text-accent-ink" : "text-ink-soft"
              }`}
            >
              <Ellipsis className="h-5 w-5" aria-hidden />
              <span>Yana</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Qo‘shimcha vositalar">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Yopish" onClick={() => setMoreOpen(false)} />
          <div className="glass glass-strong absolute inset-x-2 bottom-2 max-h-[80dvh] overflow-y-auto p-4 animate-rise">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-bold">Qo‘shimcha vositalar</p>
              <button type="button" className="btn btn-ghost h-11 w-11 !p-0" onClick={() => setMoreOpen(false)} aria-label="Yopish" autoFocus>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <GlobalSearch className="mb-3" />
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {[HOME_NAV, ...moreItems].map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-accent-soft">
                      <Icon className="h-5 w-5 text-accent" aria-hidden />
                      <span className="flex flex-col">
                        <span className="font-semibold">{item.label}</span>
                        {item.description && <span className="text-sm text-ink-muted">{item.description}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
