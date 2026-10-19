"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, Notice, Panel } from "@/components/ui/primitives";
import { authClient, authErrorMessage } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && name.trim().length < 2) return setError("Ismingizni kiriting (kamida 2 belgi).");
    if (password.length < 8) return setError("Parol kamida 8 belgidan iborat bo‘lsin.");
    setBusy(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (res.error) return setError(authErrorMessage(res.error));
    router.push(safeNext);
    router.refresh();
  }

  return (
    <Panel className="mx-auto w-full max-w-md">
      <h2 className="text-2xl font-bold">{mode === "signup" ? "Ro‘yxatdan o‘tish" : "Tizimga kirish"}</h2>
      <p className="mt-1 text-ink-soft">
        {mode === "signup"
          ? "Hisob izoh qoldirish, shaxsiy lug‘at, mashqlar va fayllar bilan ishlash uchun kerak. Qidiruv va konvertor kirishsiz ishlaydi."
          : "Hisobingizga kiring."}
      </p>
      <form className="mt-5 flex flex-col gap-4" onSubmit={submit} noValidate>
        {mode === "signup" && (
          <Field label="Ism" htmlFor="name">
            <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
        )}
        <Field label="Elektron pochta" htmlFor="email">
          <input id="email" type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Parol" htmlFor="password" hint={mode === "signup" ? "Kamida 8 belgi." : undefined}>
          <input
            id="password"
            type="password"
            className="field"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        {error && <Notice kind="danger">{error}</Notice>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Kuting…" : mode === "signup" ? "Ro‘yxatdan o‘tish" : "Kirish"}
        </button>
      </form>
      <p className="mt-4 text-center text-ink-soft">
        {mode === "signup" ? (
          <>
            Hisobingiz bormi?{" "}
            <Link className="font-semibold text-accent underline" href={`/kirish${next ? `?next=${encodeURIComponent(safeNext)}` : ""}`}>
              Kirish
            </Link>
          </>
        ) : (
          <>
            Hisobingiz yo‘qmi?{" "}
            <Link className="font-semibold text-accent underline" href={`/royxat${next ? `?next=${encodeURIComponent(safeNext)}` : ""}`}>
              Ro‘yxatdan o‘ting
            </Link>
          </>
        )}
      </p>
    </Panel>
  );
}
