"use client";
import { Check, Layers, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/fetcher";

type ExType = "idiom_meaning" | "loanword_alternative" | "spelling" | "translit";
const TYPES: Array<{ key: ExType; label: string; text: string }> = [
  { key: "idiom_meaning", label: "Ibora ma’nosini topish", text: "Iboraning to‘g‘ri ma’nosini tanlang." },
  { key: "loanword_alternative", label: "O‘zbekcha muqobilni tanlash", text: "O‘zlashma so‘zning o‘zbekcha muqobilini toping." },
  { key: "spelling", label: "To‘g‘ri yozilgan variant", text: "Ikki variantdan to‘g‘ri yozilganini aniqlang." },
  { key: "translit", label: "Lotin → kirill", text: "So‘zning kirill yozuvidagi to‘g‘ri shaklini tanlang." },
];
interface Overview {
  availability: Record<ExType, number> & { demoAllowed: boolean };
  minItems: number;
  stats: Record<string, { correct: number; wrong: number }>;
  mistakes: Array<{ id: string; type: string; prompt: string; userAnswer: string; correctAnswer: string; createdAt: string }>;
  cards: { due: number; total: number };
}
interface Q {
  type: ExType;
  prompt: string;
  options: string[];
  token: string;
  demo: boolean;
}

function Quiz({ type, onExit }: { type: ExType; onExit: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState<Q | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctAnswer: string; explanation: string } | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });

  const next = useCallback(async () => {
    setPicked(null);
    setResult(null);
    setError(null);
    try {
      setQ(await api<Q>(`/api/exercises/next?type=${type}`));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [type]);
  useEffect(() => {
    next();
  }, [next]);

  async function answer(opt: string) {
    if (!q || result) return;
    setPicked(opt);
    try {
      const r = await api<{ isCorrect: boolean; correctAnswer: string; explanation: string }>("/api/exercises/answer", { method: "POST", json: { token: q.token, answer: opt } });
      setResult(r);
      setScore((s) => ({ ok: s.ok + (r.isCorrect ? 1 : 0), total: s.total + 1 }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="glass flex flex-col gap-4 p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{TYPES.find((t) => t.key === type)?.label}</h3>
        <span className="chip text-ink-soft">
          {score.ok} / {score.total} to‘g‘ri
        </span>
      </div>
      {error && <Notice kind="warn">{error}</Notice>}
      {!q && !error && <Spinner />}
      {q && !error && (
        <>
          {q.demo && <Notice kind="warn">Bu savol namuna (tasdiqlanmagan) ma’lumotdan tuzilgan.</Notice>}
          <p className="text-xl font-semibold">{q.prompt}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.options.map((o) => {
              const isAnswer = result && o === result.correctAnswer;
              const isWrongPick = result && o === picked && !result.isCorrect;
              return (
                <li key={o}>
                  <button
                    type="button"
                    disabled={!!result}
                    onClick={() => answer(o)}
                    className={`flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 px-4 py-3 text-left text-[1.02rem] transition-colors ${
                      isAnswer ? "border-accent bg-accent-soft" : isWrongPick ? "border-danger bg-danger-soft" : "border-line hover:border-accent"
                    }`}
                  >
                    {isAnswer && <Check className="h-5 w-5 shrink-0 text-accent" aria-label="To‘g‘ri javob" />}
                    {isWrongPick && <X className="h-5 w-5 shrink-0 text-danger" aria-label="Sizning javobingiz — noto‘g‘ri" />}
                    <span>{o}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {result && (
            <Notice kind={result.isCorrect ? "success" : "danger"} title={result.isCorrect ? "To‘g‘ri!" : "Noto‘g‘ri"}>
              {result.explanation}
            </Notice>
          )}
        </>
      )}
      <div className="flex gap-2">
        {result && (
          <button type="button" className="btn btn-primary" onClick={next}>
            Keyingi savol
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          Mashqlar ro‘yxatiga qaytish
        </button>
      </div>
    </section>
  );
}

function Flashcards({ onExit }: { onExit: () => void }) {
  const toast = useToast();
  const [cards, setCards] = useState<Array<{ id: string; term: string; meaning: string | null; note: string | null }> | null>(null);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    api<{ cards: typeof cards; nextDueAt: string | null }>("/api/exercises/cards")
      .then((d) => {
        setCards(d.cards);
        setNextDue(d.nextDueAt);
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!cards) return <Spinner />;
  const card = cards[i];
  async function grade(g: 0 | 3 | 4 | 5) {
    try {
      await api(`/api/exercises/cards/${card.id}`, { method: "POST", json: { grade: g } });
      setFlipped(false);
      setI(i + 1);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <section className="glass flex flex-col gap-4 p-5">
      <h3 className="text-lg font-bold">Kartochkalar bilan takrorlash</h3>
      {!card ? (
        <Notice kind="success" title="Hozircha takrorlanadigan kartochka yo‘q">
          {nextDue ? `Keyingi takrorlash: ${new Date(nextDue).toLocaleString("uz-UZ")}.` : "Shaxsiy lug‘atingizga so‘z va iboralar qo‘shing."}
        </Notice>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {i + 1} / {cards.length}
          </p>
          <button
            type="button"
            className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-line bg-[var(--glass-strong)] p-6 text-center"
            onClick={() => setFlipped(true)}
            aria-label={flipped ? "Kartochka ochilgan" : "Javobni ko‘rish uchun bosing"}
          >
            <span className="text-2xl font-bold">{card.term}</span>
            {flipped ? (
              <>
                <span className="text-lg text-ink-soft">{card.meaning ?? "Ma’no kiritilmagan."}</span>
                {card.note && <span className="text-sm italic text-ink-muted">{card.note}</span>}
              </>
            ) : (
              <span className="text-sm text-ink-muted">Ma’nosini eslang, so‘ng bosing</span>
            )}
          </button>
          {flipped && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" className="btn btn-danger" onClick={() => grade(0)}>
                Bilmadim
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => grade(3)}>
                Qiynaldim
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => grade(4)}>
                Bildim
              </button>
              <button type="button" className="btn btn-primary" onClick={() => grade(5)}>
                Oson
              </button>
            </div>
          )}
          <p className="text-sm text-ink-muted">Keyingi takrorlash vaqti javobingizga qarab belgilanadi: bilmagan kartochka tezroq, oson kartochka kechroq qaytadi.</p>
        </>
      )}
      <button type="button" className="btn btn-ghost self-start" onClick={onExit}>
        Mashqlar ro‘yxatiga qaytish
      </button>
    </section>
  );
}

export function Exercises() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [mode, setMode] = useState<ExType | "cards" | null>(null);
  const load = useCallback(() => api<Overview>("/api/exercises").then(setOv), []);
  useEffect(() => {
    if (!mode) load().catch(() => {});
  }, [mode, load]);
  if (mode === "cards") return <Flashcards onExit={() => setMode(null)} />;
  if (mode) return <Quiz type={mode} onExit={() => setMode(null)} />;
  if (!ov) return <Spinner />;
  return (
    <div className="flex flex-col gap-5">
      <Notice kind="info">
        Savollar faqat tasdiqlangan lug‘at ma’lumotlaridan tuziladi. Hamjamiyat izohlari va tekshirilmagan yozuvlar to‘g‘ri javob sifatida ishlatilmaydi.
        {ov.availability.demoAllowed && " Hozir namuna ma’lumotlardan foydalanish yoqilgan — bunday savollar alohida belgilanadi."}
      </Notice>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPES.map((t) => {
          const n = ov.availability[t.key];
          const enough = n >= ov.minItems;
          const s = ov.stats[t.key];
          return (
            <li key={t.key} className="glass flex flex-col gap-2 p-5">
              <h3 className="text-lg font-bold">{t.label}</h3>
              <p className="text-ink-soft">{t.text}</p>
              <p className="text-sm text-ink-muted">
                Mavjud yozuvlar: {n} · Natijangiz: {s.correct} to‘g‘ri, {s.wrong} xato
              </p>
              {enough ? (
                <button type="button" className="btn btn-primary mt-auto self-start" onClick={() => setMode(t.key)}>
                  Boshlash
                </button>
              ) : (
                <p className="mt-auto rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                  Yetarli tasdiqlangan savol yo‘q (kamida {ov.minItems} ta yozuv kerak, hozir {n} ta).
                </p>
              )}
            </li>
          );
        })}
        <li className="glass flex flex-col gap-2 p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Layers className="h-5 w-5 text-accent" aria-hidden /> Kartochkalar
          </h3>
          <p className="text-ink-soft">Shaxsiy lug‘atingizdagi so‘zlarni takrorlang.</p>
          <p className="text-sm text-ink-muted">
            Takrorlash vaqti kelgan: {ov.cards.due} · Jami: {ov.cards.total}
          </p>
          {ov.cards.total ? (
            <button type="button" className="btn btn-primary mt-auto self-start" onClick={() => setMode("cards")}>
              Takrorlash
            </button>
          ) : (
            <Link href="/lugatim" className="btn btn-ghost mt-auto self-start">
              Shaxsiy lug‘atga o‘tish
            </Link>
          )}
        </li>
      </ul>
      {ov.mistakes.length > 0 && (
        <section className="glass p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <RotateCcw className="h-5 w-5 text-warn" aria-hidden /> Xatolar tarixi
          </h3>
          <p className="text-sm text-ink-muted">Xato javob berilgan savollar keyingi mashqlarda tez-tez qaytariladi.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {ov.mistakes.map((m) => (
              <li key={m.id} className="border-t border-line pt-2">
                <p className="font-semibold">{m.prompt}</p>
                <p className="text-sm">
                  <span className="text-danger">Sizning javobingiz: {m.type === "flashcard" ? "bilmadim" : m.userAnswer}</span>
                  {m.type !== "flashcard" && <span className="text-accent"> · To‘g‘ri: {m.correctAnswer}</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
