"use client";
import { Microscope, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";

interface Analysis {
  root: string;
  pos: string | null;
  inferredPos: string | null;
  meaning: string | null;
  affixes: Array<{ form: string; kind: string; name: string }>;
  basis: "lug‘at" | "qoidaviy taxmin";
  lexiconStatus?: string;
  note?: string;
}
interface WordResult {
  word: string;
  cyrillic: string;
  syllables: string[];
  letters: { phonemes: Array<{ letter: string; kind: string; feature?: string }>; letters: number; sounds: number; vowels: number; consonants: number; note: string };
  analyses: Analysis[];
  examples: Array<{ lemma: string; text: string }>;
  ambiguous: boolean;
  lexiconFound: boolean;
}
interface SentenceResult {
  words: string[];
  roles: Array<{ index: number; word: string; role: string; question: string; basis: string; explanation: string; alternative?: string; head?: number }>;
  links: Array<{ from: number; to: number; type: string }>;
  warnings: string[];
}

const BASIS: Record<string, { text: string; cls: string }> = {
  "lug‘at": { text: "Lug‘at ma’lumoti", cls: "bg-accent-soft text-accent" },
  qoida: { text: "Qoidaviy natija", cls: "bg-info-soft text-info" },
  "qoidaviy taxmin": { text: "Qoidaviy taxmin", cls: "bg-warn-soft text-warn" },
  taxmin: { text: "Taxmin", cls: "bg-warn-soft text-warn" },
};
const ROLE_STYLE: Record<string, string> = {
  ega: "border-b-2 border-ink",
  kesim: "border-b-4 border-double border-ink",
  aniqlovchi: "border-b-2 border-wavy border-ink",
  "to‘ldiruvchi": "border-b-2 border-dashed border-ink",
  hol: "border-b-2 border-dotted border-ink",
};
const LINK: Record<string, string> = { predikativ: "predikativ (ega — kesim)", moslashuv: "moslashuv", boshqaruv: "boshqaruv", bitishuv: "bitishuv" };

function WordView({ r }: { r: WordResult }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="glass p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="text-2xl font-bold">{r.word}</h3>
          <span className="text-ink-muted">Kirillda: {r.cyrillic}</span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-ink-muted">Bo‘g‘inlar</dt>
            <dd className="text-lg font-semibold">
              {r.syllables.join(" - ")} <span className="text-sm text-ink-muted">({r.syllables.length} bo‘g‘in)</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-muted">Harflar / tovushlar</dt>
            <dd className="text-lg font-semibold">
              {r.letters.letters} harf, {r.letters.sounds} tovush
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-muted">Unli / undosh</dt>
            <dd className="text-lg font-semibold">
              {r.letters.vowels} unli, {r.letters.consonants} undosh
            </dd>
          </div>
        </dl>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Harf va tovush tahlili">
          {r.letters.phonemes.map((p, i) => (
            <li key={i} className={`rounded-xl border px-2.5 py-1.5 text-center ${p.kind === "unli" ? "border-accent/40 bg-accent-soft" : p.kind === "belgi" ? "border-warn/40 bg-warn-soft" : "border-line"}`}>
              <span className="block text-lg font-bold">{p.letter}</span>
              <span className="block text-xs text-ink-soft">{p.kind}</span>
              {p.feature && <span className="block text-xs text-ink-muted">{p.feature}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-muted">{r.letters.note}</p>
      </section>

      {r.ambiguous && (
        <Notice kind="info" title="Bir nechta tahlil mumkin">
          Bu so‘z turli ma’no va tuzilishda bo‘lishi mumkin. Aniq tahlil uchun so‘zni gap ichida kiriting (“Gap” rejimi).
        </Notice>
      )}
      {!r.lexiconFound && (
        <Notice kind="warn" title="O‘zak lug‘atda topilmadi">
          Quyidagi ajratish faqat qo‘shimchalar qoidasiga asoslangan taxmin. Lug‘aviy ma’no va so‘z turkumini aniqlash uchun lug‘at ma’lumoti yetarli emas.
        </Notice>
      )}

      {r.analyses.map((a, i) => (
        <section key={i} className="glass p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{r.analyses.length > 1 ? `${i + 1}-tahlil` : "Tarkibi"}</h3>
            <span className={`chip ${BASIS[a.basis].cls}`}>{BASIS[a.basis].text}</span>
            {a.lexiconStatus && <span className="chip text-ink-soft">lug‘at yozuvi: {a.lexiconStatus}</span>}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-1 text-xl" aria-label="So‘z tarkibi">
            <span className="rounded-lg bg-accent-soft px-2 py-1 font-bold text-accent">{a.root}</span>
            {a.affixes.map((x, j) => (
              <span key={j} className={`rounded-lg px-2 py-1 ${x.kind === "so‘z yasovchi" ? "bg-info-soft text-info" : "bg-warn-soft text-warn"}`}>
                -{x.form}
              </span>
            ))}
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-ink-muted">O‘zak</dt>
              <dd>{a.root}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink-muted">So‘z turkumi</dt>
              <dd>{a.pos ?? (a.inferredPos ? `${a.inferredPos} (qo‘shimchadan taxmin)` : "aniqlanmadi")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-ink-muted">Lug‘aviy ma’no</dt>
              <dd>{a.meaning ?? "Lug‘atda ma’no kiritilmagan."}</dd>
            </div>
          </dl>
          {a.affixes.length > 0 && (
            <table className="mt-3 w-full text-left text-[0.95rem]">
              <thead className="text-sm text-ink-muted">
                <tr>
                  <th className="py-1">Qo‘shimcha</th>
                  <th>Turi</th>
                  <th>Vazifasi (grammatik shakl)</th>
                </tr>
              </thead>
              <tbody>
                {a.affixes.map((x, j) => (
                  <tr key={j} className="border-t border-line">
                    <td className="py-1.5 font-semibold">-{x.form}</td>
                    <td>{x.kind}</td>
                    <td>{x.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {a.note && <p className="mt-2 text-sm text-ink-muted">Izoh: {a.note}</p>}
        </section>
      ))}

      {r.examples.length > 0 && (
        <section className="glass p-5">
          <h3 className="font-bold">Misollar (lug‘atdan)</h3>
          <ul className="mt-2 list-inside list-disc text-ink-soft">
            {r.examples.map((e, i) => (
              <li key={i}>{e.text}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SentenceView({ r }: { r: SentenceResult }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="glass p-5">
        <p className="flex flex-wrap gap-x-3 gap-y-4 text-xl leading-loose">
          {r.roles.map((w) => (
            <span key={w.index} className="inline-flex flex-col items-center">
              <span className={`px-0.5 ${ROLE_STYLE[w.role] ?? ""}`}>{w.word}</span>
              <span className="text-xs font-semibold text-ink-muted">{w.role === "noma’lum" ? "—" : w.role}</span>
            </span>
          ))}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Chiziqlar maktab an’anasiga ko‘ra: ega — bitta chiziq, kesim — ikki chiziq, aniqlovchi — to‘lqinli, to‘ldiruvchi — uzuq, hol — nuqtali. Har bir so‘z ostida bo‘lak nomi
          matn bilan ham yozilgan.
        </p>
      </section>
      {r.warnings.map((w) => (
        <Notice key={w} kind="warn">
          {w}
        </Notice>
      ))}
      <ul className="flex flex-col gap-2">
        {r.roles
          .filter((w) => w.role !== "noma’lum" || w.explanation)
          .map((w) => (
            <li key={w.index} className="glass p-4">
              <p className="flex flex-wrap items-center gap-2">
                <strong className="text-lg">{w.word}</strong>
                <span className="chip text-ink-soft">{w.role === "noma’lum" ? "bo‘lak aniqlanmadi" : w.role}</span>
                {w.question && <span className="text-sm text-ink-muted">so‘roq: {w.question}</span>}
                <span className={`chip ${BASIS[w.basis]?.cls ?? ""}`}>{BASIS[w.basis]?.text ?? w.basis}</span>
              </p>
              <p className="mt-1 text-ink-soft">{w.explanation}</p>
              {w.alternative && <p className="mt-1 text-sm text-ink-muted">Muqobil talqin: {w.alternative}</p>}
              {w.head !== undefined && r.words[w.head] && <p className="mt-1 text-sm text-ink-muted">Bog‘lanadi: “{r.words[w.head]}”</p>}
            </li>
          ))}
      </ul>
      {r.links.length > 0 && (
        <section className="glass p-5">
          <h3 className="font-bold">Birikmalar va bog‘lanishlar</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {r.links.map((l, i) => (
              <li key={i}>
                {r.words[l.from]} → {r.words[l.to]} <span className="text-sm text-ink-muted">({LINK[l.type] ?? l.type})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AiSentence({ sentence }: { sentence: string }) {
  const { data: session } = authClient.useSession();
  const toast = useToast();
  const [status, setStatus] = useState<{ ai: { connected: boolean; provider: string | null } } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ parts: Array<{ words: string; role: string; question: string; explanation: string }>; note: string } | null>(null);
  useEffect(() => {
    api<typeof status>("/api/status").then(setStatus).catch(() => {});
  }, []);
  if (!status) return null;
  return (
    <section className="glass p-5">
      <h3 className="flex items-center gap-2 font-bold">
        <Sparkles className="h-5 w-5 text-info" aria-hidden /> AI taxmini
      </h3>
      {!status.ai.connected ? (
        <p className="mt-1 text-sm text-ink-soft">Xizmat ulanmagan. Yuqoridagi natijalar faqat qoidaviy tahlil va lug‘at ma’lumotiga asoslangan.</p>
      ) : !session ? (
        <p className="mt-1 text-sm text-ink-soft">AI tahlili uchun tizimga kiring.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Gapingiz {status.ai.provider} xizmatiga yuboriladi. Natija taxmin sifatida alohida ko‘rsatiladi.</p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Gapni yuborishga roziman
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2"
            disabled={!consent || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setRes(await api("/api/ai/analyze", { method: "POST", json: { sentence, consent } }));
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Kutilmoqda…" : "AI taxminini olish"}
          </button>
          {res && (
            <ul className="mt-3 flex flex-col gap-2">
              {res.parts.map((p, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <span className="chip bg-info-soft text-info">AI taxmini</span> <strong>{p.words}</strong> — {p.role} ({p.question})
                  <p className="text-sm text-ink-soft">{p.explanation}</p>
                </li>
              ))}
              {res.note && <li className="text-sm text-ink-muted">{res.note}</li>}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function Analyzer() {
  const [mode, setMode] = useState<"word" | "sentence">("word");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState<{ mode: string; q: string } | null>(null);
  const [word, setWord] = useState<WordResult | null>(null);
  const [sent, setSent] = useState<SentenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<WordResult & SentenceResult>(`/api/analyze?mode=${mode}&q=${encodeURIComponent(q)}`);
      if (mode === "word") {
        setWord(r);
        setSent(null);
      } else {
        setSent(r);
        setWord(null);
      }
      setSubmitted({ mode, q });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice kind="info" title="Tahlil qanday bajariladi">
        Natijalar uch xil belgilanadi: <strong>lug‘at ma’lumoti</strong> (bazadagi o‘zak va turkum), <strong>qoidaviy natija</strong> (qo‘shimchalar va so‘z tartibi qoidalari) va{" "}
        <strong>taxmin</strong>. Gap bo‘laklari faqat qo‘shimchaga qarab qat’iy belgilanmaydi — noaniq holatlarda muqobil talqin ham beriladi.
      </Notice>
      <form onSubmit={run} className="glass flex flex-col gap-3 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Tahlil turi" className="flex gap-1">
          {(["word", "sentence"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-xl px-4 py-2 font-semibold ${mode === m ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-accent-soft"}`}
            >
              {m === "word" ? "So‘z" : "Gap"}
            </button>
          ))}
        </div>
        <label htmlFor="an-q" className="font-semibold">
          {mode === "word" ? "So‘z" : "Gap"}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="an-q"
            className="field !text-lg"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "word" ? "Masalan: kitoblarimizdan" : "Masalan: Men bugun do‘stimga xat yozdim."}
            maxLength={500}
          />
          <button className="btn btn-primary !min-h-12 sm:w-40" disabled={busy}>
            <Microscope className="h-5 w-5" aria-hidden /> Tahlil qilish
          </button>
        </div>
      </form>
      {busy && <Spinner label="Tahlil qilinmoqda…" />}
      {error && <Notice kind="danger">{error}</Notice>}
      {word && <WordView r={word} />}
      {sent && (
        <>
          <SentenceView r={sent} />
          {submitted && <AiSentence sentence={submitted.q} />}
        </>
      )}
    </div>
  );
}
