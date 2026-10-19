"use client";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const { data, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) return <span className="h-11 w-11 rounded-full bg-line" aria-hidden />;
  if (!data) {
    return (
      <Link href="/kirish" className="btn btn-primary">
        <User className="h-4 w-4" aria-hidden />
        <span>Kirish</span>
      </Link>
    );
  }
  const user = data.user as typeof data.user & { role?: string };
  const staff = user.role === "admin" || user.role === "moderator";
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-full bg-accent text-base font-bold text-accent-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Profil menyusi: ${user.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="glass glass-strong absolute right-0 top-13 z-50 w-64 p-2 animate-rise">
          <div className="px-3 py-2">
            <p className="font-semibold">{user.name}</p>
            <p className="truncate text-sm text-ink-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href="/profil" className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-accent-soft" onClick={() => setOpen(false)}>
            <Settings className="h-4 w-4" aria-hidden /> Profil va sozlamalar
          </Link>
          {staff && (
            <Link role="menuitem" href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-accent-soft" onClick={() => setOpen(false)}>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Admin paneli
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-danger-soft"
            onClick={async () => {
              await authClient.signOut();
              setOpen(false);
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Chiqish
          </button>
        </div>
      )}
    </div>
  );
}
