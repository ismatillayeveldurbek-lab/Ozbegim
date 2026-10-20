"use client";
import { Copy, Languages, Trash2 } from "lucide-react";
import { useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const MAX = 2000;
interface Result {
  source_language: string;
  translation: string;
  understood: boolean;
}

export function TouristTranslator() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function translate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) {
      setResult(null);
      setError("Iltimos, tarjima qilinadigan matnni kiriting");
      return;
    }
    setBusy(true);
    try {
      setResult(await api<Result>("/api/ai/translate", { method: "POST", json: { text } }));
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={translate} className="glass flex flex-col gap-2 p-4" noValidate>
          <label htmlFor="tourist-translator-input" className="font-semibold">
            Matn (istalgan tilda)
          </label>
          <textarea
            id="tourist-translator-input"
            className="field min-h-48 flex-1 resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) translate(e);
            }}
            placeholder="Masalan: How can I get to the Registan from my hotel?"
            maxLength={MAX}
            aria-describedby="tourist-translator-note"
          />
          <p className="text-sm text-ink-muted">
            {text.length} / {MAX} belgi · Ctrl+Enter — tarjima
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy}>
              <Languages className="h-4 w-4" aria-hidden /> Tarjima qilish
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (setText(""), setResult(null), setError(null))} disabled={!text}>
              <Trash2 className="h-4 w-4" aria-hidden /> Tozalash
            </button>
          </div>
          <p id="tourist-translator-note" className="text-sm text-ink-muted">
            Matn tarjima uchun AI xizmatiga (Anthropic Claude) yuboriladi va saytda saqlanmaydi. Shaxsiy ma’lumotlarni (pasport raqami, karta ma’lumotlari) kiritmang.
          </p>
        </form>

        <section className="glass flex flex-col gap-2 p-4" aria-live="polite" aria-labelledby="tourist-translator-out-label">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="tourist-translator-out-label" className="font-semibold">
              O‘zbekcha tarjima
            </h3>
            {result?.understood && result.source_language && <span className="tourist-translator-lang">Asl til: {result.source_language}</span>}
          </div>
          {busy && <Spinner label="Tarjima qilinmoqda..." />}
          {!busy && error && <Notice kind={error.includes("ulanmagan") ? "warn" : "danger"}>{error.includes("ulanmagan") ? "AI xizmati ulanmagan — tarjimon hozircha ishlamaydi." : error}</Notice>}
          {!busy && result && !result.understood && <Notice kind="warn">{result.translation}</Notice>}
          {!busy && result?.understood && (
            <>
              <textarea className="field min-h-48 flex-1 resize-y" readOnly value={result.translation} aria-label="Tarjima natijasi" />
              <button
                type="button"
                className="btn btn-ghost self-start"
                onClick={() => navigator.clipboard.writeText(result.translation).then(() => toast.success("Nusxalandi."), () => toast.error("Nusxalab bo‘lmadi."))}
              >
                <Copy className="h-4 w-4" aria-hidden /> Nusxalash
              </button>
            </>
          )}
          {!busy && !result && !error && <p className="text-ink-muted">Tarjima shu yerda chiqadi.</p>}
        </section>
      </div>
      <Notice kind="info" title="Tarjima qoidalari">
        Tarjima zamonaviy adabiy o‘zbek tilida, lotin yozuvida va “Siz” shaklida beriladi. Ismlar, brendlar, mehmonxona nomlari va manzillar tarjima qilinmaydi; raqamlar,
        narxlar, sanalar, telefon va email o‘zgarmaydi; mashhur joy nomlari o‘zbekcha shaklda yoziladi (Samarqand, Buxoro, Xiva, Registon). AI tarjimasida xato bo‘lishi mumkin.
      </Notice>
    </div>
  );
}
