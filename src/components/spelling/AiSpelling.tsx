"use client";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";

interface AiSugg {
  original: string;
  replacement: string;
  explanation: string;
}

/** AI tavsiyalari — qoidaviy tekshiruvdan alohida, aniq belgilangan. */
export function AiSpelling({ text, onApply }: { text: string; onApply: (next: string) => void }) {
  const { data: session } = authClient.useSession();
  const toast = useToast();
  const [status, setStatus] = useState<{ ai: { connected: boolean; provider: string | null; message: string } } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<AiSugg[] | null>(null);

  useEffect(() => {
    api<typeof status>("/api/status").then(setStatus).catch(() => {});
  }, []);

  if (!status) return null;
  return (
    <section className="glass p-4" aria-labelledby="ai-title">
      <h3 id="ai-title" className="flex items-center gap-2 font-bold">
        <Sparkles className="h-5 w-5 text-info" aria-hidden /> AI tavsiyalari
      </h3>
      {!status.ai.connected ? (
        <p className="mt-1 text-sm text-ink-soft">Xizmat ulanmagan. Yuqoridagi tavsiyalar faqat qoidaviy tekshiruv natijasi.</p>
      ) : !session ? (
        <p className="mt-1 text-sm text-ink-soft">AI tavsiyalaridan foydalanish uchun tizimga kiring.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Bu tugma matningizni (8000 belgigacha) <strong>{status.ai.provider}</strong> xizmatiga yuboradi. AI tavsiyalari taxmin bo‘lib, xato bo‘lishi mumkin.
          </p>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Matnimni shu xizmatga yuborishga roziman
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2"
            disabled={!consent || !text.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setItems((await api<{ suggestions: AiSugg[] }>("/api/ai/spelling", { method: "POST", json: { text, consent } })).suggestions);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Kutilmoqda…" : "AI tavsiyalarini olish"}
          </button>
          {items && items.length === 0 && <Notice kind="success" className="mt-2">AI qo‘shimcha xato topmadi.</Notice>}
          {items && items.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((s, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <span className="chip bg-info-soft text-info">AI taxmini</span>
                  <p className="mt-1">
                    <del className="text-danger">{s.original}</del> → <strong className="text-accent">{s.replacement}</strong>
                  </p>
                  <p className="text-sm text-ink-soft">{s.explanation}</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-1"
                    onClick={() => {
                      const idx = text.indexOf(s.original);
                      if (idx < 0) return toast.info("Bu parcha matnda endi yo‘q.");
                      onApply(text.slice(0, idx) + s.replacement + text.slice(idx + s.original.length));
                      setItems(items.filter((_, j) => j !== i));
                    }}
                  >
                    Qabul qilish
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
