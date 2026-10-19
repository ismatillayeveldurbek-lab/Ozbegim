/**
 * Mashqlar: savollar FAQAT tasdiqlangan (VERIFIED) bazadan tuziladi. Hamjamiyat izohlari
 * va tekshirilmagan yozuvlar "to‘g‘ri javob" sifatida ishlatilmaydi.
 * Namuna (DEMO) ma’lumotlar faqat EXERCISES_ALLOW_DEMO=true bo‘lsa va aniq belgilangan holda.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cyrillicDistractors, shuffle } from "@/lib/exercises/distractors";
import { transliterate } from "@/lib/uz/translit";
import { prisma } from "./db";
import { HttpError } from "./http";

export type ExerciseType = "idiom_meaning" | "loanword_alternative" | "spelling" | "translit";
export const EXERCISE_TYPES: ExerciseType[] = ["idiom_meaning", "loanword_alternative", "spelling", "translit"];
export const MIN_ITEMS = 4;

const allowDemo = () => process.env.EXERCISES_ALLOW_DEMO === "true";
/** Tasdiqlangan va namuna bo‘lmagan; demo ruxsat etilsa — namunalar ham (alohida belgilanadi). */
const entryFilter = () =>
  allowDemo() ? { OR: [{ status: "VERIFIED" as const, origin: { not: "DEMO" as const } }, { origin: "DEMO" as const }] } : { status: "VERIFIED" as const, origin: { not: "DEMO" as const } };

interface Payload {
  t: ExerciseType;
  ref: string;
  prompt: string;
  answer: string;
  explanation: string;
  exp: number;
}

interface Question {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  ref: string;
  demo: boolean;
}

const secret = () => process.env.BETTER_AUTH_SECRET || "dev-secret";

function sign(p: Payload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** To‘g‘ri javob mijozga yuborilmaydi — u faqat server imzolagan token ichida. */
export function verifyToken(token: string): Payload {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new HttpError(400, "Savol tokeni noto‘g‘ri.");
  const expect = createHmac("sha256", secret()).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) throw new HttpError(400, "Savol tokeni noto‘g‘ri.");
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
  if (p.exp < Date.now()) throw new HttpError(410, "Savol muddati o‘tgan. Yangi savol oling.");
  return p;
}

/** Har bir mashq turi uchun nechta yaroqli yozuv borligi. */
export async function availability() {
  const filter = entryFilter();
  const [idioms, loanwords, loanwordsAll, spelling] = await Promise.all([
    prisma.idiom.count({ where: filter }),
    prisma.loanword.count({ where: { ...filter, alternatives: { some: {} } } }),
    prisma.loanword.count({ where: filter }),
    prisma.spellingPair.count({ where: filter }),
  ]);
  return { idiom_meaning: idioms, loanword_alternative: loanwords, spelling, translit: idioms + loanwordsAll, demoAllowed: allowDemo() };
}

/** Avval xato qilingan elementlar ustuvor (40% ehtimol bilan) — takrorlash. */
async function recentMistakeRef(userId: string, type: ExerciseType) {
  if (Math.random() > 0.4) return null;
  const m = await prisma.exerciseAttempt.findFirst({
    where: { userId, type, isCorrect: false, createdAt: { gt: new Date(Date.now() - 14 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
  });
  return m?.itemRef ?? null;
}

async function idiomQuestion(count: number, mistake: string | null): Promise<Question> {
  const filter = entryFilter();
  const item =
    (mistake ? await prisma.idiom.findFirst({ where: { AND: [{ id: mistake }, filter] }, include: { senses: true } }) : null) ??
    (await prisma.idiom.findFirst({ where: filter, include: { senses: true }, skip: randomInt(count), orderBy: { id: "asc" } }));
  if (!item?.senses.length) throw new HttpError(409, "Savol tuzib bo‘lmadi.");
  const sense = item.senses[randomInt(item.senses.length)];
  const others = await prisma.idiomSense.findMany({ where: { idiom: { AND: [filter, { id: { not: item.id } }] } }, select: { meaning: true }, take: 60 });
  const distract = shuffle([...new Set(others.map((o) => o.meaning))].filter((m) => m !== sense.meaning)).slice(0, 3);
  return {
    prompt: `“${item.phrase}” iborasi qanday ma’noni bildiradi?`,
    options: shuffle([sense.meaning, ...distract]),
    answer: sense.meaning,
    explanation: `“${item.phrase}” — ${sense.meaning}${sense.example ? ` Misol: ${sense.example}` : ""}`,
    ref: item.id,
    demo: item.origin === "DEMO",
  };
}

async function loanwordQuestion(count: number, mistake: string | null): Promise<Question> {
  const where = { AND: [entryFilter(), { alternatives: { some: {} } }] };
  const item =
    (mistake ? await prisma.loanword.findFirst({ where: { AND: [...where.AND, { id: mistake }] }, include: { alternatives: true } }) : null) ??
    (await prisma.loanword.findFirst({ where, include: { alternatives: true }, skip: randomInt(count), orderBy: { id: "asc" } }));
  if (!item) throw new HttpError(409, "Savol tuzib bo‘lmadi.");
  const correct = item.alternatives[randomInt(item.alternatives.length)].text;
  const own = new Set(item.alternatives.map((a) => a.text));
  const others = await prisma.loanwordAlternative.findMany({ where: { loanword: { AND: [...where.AND, { id: { not: item.id } }] } }, select: { text: true }, take: 60 });
  const distract = shuffle([...new Set(others.map((o) => o.text))].filter((t) => !own.has(t))).slice(0, 3);
  return {
    prompt: `“${item.word}” so‘zining o‘zbekcha muqobilini tanlang.`,
    options: shuffle([correct, ...distract]),
    answer: correct,
    explanation:
      `“${item.word}” o‘rnida ${item.alternatives.map((a) => `“${a.text}”${a.usageNote ? ` (${a.usageNote})` : ""}`).join(", ")} ishlatish mumkin.` +
      (item.meaning ? ` Ma’nosi: ${item.meaning}` : ""),
    ref: item.id,
    demo: item.origin === "DEMO",
  };
}

async function spellingQuestion(count: number, mistake: string | null): Promise<Question> {
  const filter = entryFilter();
  const item =
    (mistake ? await prisma.spellingPair.findFirst({ where: { AND: [{ id: mistake }, filter] } }) : null) ??
    (await prisma.spellingPair.findFirst({ where: filter, skip: randomInt(count), orderBy: { id: "asc" } }));
  if (!item) throw new HttpError(409, "Savol tuzib bo‘lmadi.");
  return {
    prompt: "Qaysi variant to‘g‘ri yozilgan?",
    options: shuffle([item.correct, item.wrong]),
    answer: item.correct,
    explanation: `To‘g‘ri yozilishi: “${item.correct}”.${item.note ? ` ${item.note}` : ""}`,
    ref: item.id,
    demo: item.origin === "DEMO",
  };
}

async function translitQuestion(): Promise<Question> {
  const filter = entryFilter();
  const [ic, lc] = await Promise.all([prisma.idiom.count({ where: filter }), prisma.loanword.count({ where: filter })]);
  // Istisno yoki ism belgisi tushgan (bir ma’noli bo‘lmagan) so‘zlar savolga olinmaydi.
  for (let attempt = 0; attempt < 10; attempt++) {
    const useIdiom = lc === 0 || (ic > 0 && randomInt(2) === 0);
    const row = useIdiom
      ? await prisma.idiom.findFirst({ where: filter, skip: randomInt(ic), orderBy: { id: "asc" }, select: { phrase: true, origin: true } })
      : await prisma.loanword.findFirst({ where: filter, skip: randomInt(lc), orderBy: { id: "asc" }, select: { word: true, origin: true } });
    if (!row) continue;
    const text = "phrase" in row ? row.phrase : row.word;
    const r = transliterate(text, { direction: "lat2cyr", protect: false });
    if (r.flags.length) continue;
    const distract = cyrillicDistractors(r.text);
    if (distract.length < 2) continue;
    return {
      prompt: `“${text}” kirill yozuvida qanday yoziladi?`,
      options: shuffle([r.text, ...distract]),
      answer: r.text,
      explanation: `To‘g‘ri: “${r.text}”. O‘, G‘, H, Q harflari kirillda alohida harflar bilan yoziladi (ў, ғ, ҳ, қ).`,
      ref: text,
      demo: row.origin === "DEMO",
    };
  }
  throw new HttpError(409, "Lotin-kirill mashqi uchun mos so‘z topilmadi.");
}

export async function nextQuestion(userId: string, type: ExerciseType) {
  const avail = await availability();
  if (avail[type] < MIN_ITEMS)
    throw new HttpError(
      409,
      `Bu mashq uchun tasdiqlangan ma’lumot yetarli emas (${avail[type]} ta, kamida ${MIN_ITEMS} ta kerak). Administrator tasdiqlangan lug‘at yozuvlarini qo‘shgach, mashq ochiladi.`,
      "NOT_ENOUGH",
    );
  const mistake = type === "translit" ? null : await recentMistakeRef(userId, type);
  const q =
    type === "idiom_meaning"
      ? await idiomQuestion(avail.idiom_meaning, mistake)
      : type === "loanword_alternative"
        ? await loanwordQuestion(avail.loanword_alternative, mistake)
        : type === "spelling"
          ? await spellingQuestion(avail.spelling, mistake)
          : await translitQuestion();
  const token = sign({ t: type, ref: q.ref, prompt: q.prompt, answer: q.answer, explanation: q.explanation, exp: Date.now() + 30 * 60_000 });
  return { type, prompt: q.prompt, options: q.options, token, demo: q.demo };
}
