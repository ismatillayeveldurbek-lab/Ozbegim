/**
 * Gap bo‘laklari tahlili tashqi xizmat orqali (maktab grammatikasi bo‘yicha). Natija qoidaviy tahlil bilan
 * bir xil ko‘rinishda qaytadi (har bir so‘z — bo‘lak, so‘roq, izoh, bog‘langan so‘z). 30 kun keshlanadi.
 */
import type { Prisma } from "@generated/prisma/client";
import { toTypographic } from "@/lib/uz/alphabet";
import { normalizeKey } from "@/lib/uz/normalize";
import { AI_MODEL, aiJson } from "./ai";
import { prisma } from "./db";
import { HttpError } from "./http";

export const SENTENCE_ROLES = ["ega", "kesim", "aniqlovchi", "to‘ldiruvchi", "hol", "undalma", "kirish so‘z", "yordamchi"] as const;
type Role = (typeof SENTENCE_ROLES)[number];
export const POS_LIST = ["ot", "sifat", "son", "olmosh", "fe’l", "ravish", "ko‘makchi", "bog‘lovchi", "yuklama", "undov", "modal so‘z", "taqlid so‘z"] as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["words", "maqsad", "tuzilish", "yoyiqlik", "asos", "izoh"],
  properties: {
    maqsad: { type: "string", enum: ["darak", "so‘roq", "buyruq", "undov"] },
    tuzilish: { type: "string", enum: ["sodda", "qo‘shma"] },
    yoyiqlik: { type: "string", enum: ["yig‘iq", "yoyiq"] },
    asos: { type: "string" },
    izoh: { type: "string" },
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "role", "pos", "question", "explanation", "head"],
        properties: {
          i: { type: "integer" },
          pos: { type: "string", enum: [...POS_LIST] },
          role: { type: "string", enum: [...SENTENCE_ROLES] },
          question: { type: "string" },
          explanation: { type: "string" },
          head: { type: "integer" },
        },
      },
    },
  },
};

export const SENTENCE_PROMPT = `Sen o‘zbek tili sintaksisi bo‘yicha mutaxassis o‘qituvchisan. Gapni maktab grammatikasi (o‘zbek tili darsliklari) bo‘yicha gap bo‘laklariga ajrat.
Senga gapning so‘zlari raqamlangan holda beriladi. HAR BIR so‘z uchun bitta yozuv qaytar:
- "i" — so‘z raqami;
- "pos" — so‘z turkumi (ot, sifat, son, olmosh, fe’l, ravish, ko‘makchi, bog‘lovchi, yuklama, undov, modal so‘z, taqlid so‘z); sifatdosh, ravishdosh, harakat nomi — fe’l;
- "role" — ega, kesim, aniqlovchi, to‘ldiruvchi, hol, undalma, kirish so‘z yoki yordamchi (ko‘makchi, bog‘lovchi, yuklama — mustaqil bo‘lak emas; ular qaysi so‘z bilan birga bo‘lak bo‘lsa, "head" da o‘sha so‘z);
- "question" — shu bo‘lakka beriladigan aniq so‘roq (masalan: kim?, nima qiladi?, qanday?, kimning?, nimadan?, qayerda?, qachon?); yordamchi so‘z uchun "";
- "explanation" — 1 gaplik aniq izoh: nega shu bo‘lak, qaysi so‘zga qanday bog‘langan;
- "head" — tobe bo‘lsa, bog‘langan so‘z raqami (aniqlovchi → aniqlanmish, to‘ldiruvchi/hol → kesim yoki boshqaruvchi so‘z, ega → kesim); kesim, undalma va kirish so‘z uchun -1.
Gap haqida umumiy ma’lumot ham ber:
- "maqsad" — ifoda maqsadiga ko‘ra: darak, so‘roq, buyruq yoki undov gap;
- "tuzilish" — sodda yoki qo‘shma gap; "yoyiqlik" — sodda gap uchun yig‘iq (faqat ega va kesim) yoki yoyiq (ikkinchi darajali bo‘laklar bor); qo‘shma gapda — yoyiq;
- "asos" — grammatik asos, masalan: "Inson (ega) — o‘rganadi (kesim)"; yashirin ega bo‘lsa: "(men) — bordim (kesim), ega yashirin"; qo‘shma gapda har bir qismning asosi;
- "izoh" — 1–2 gap: uyushiq bo‘laklar, qo‘shma gap turi (bog‘langan, ergashgan, bog‘lovchisiz) yoki boshqa muhim xususiyat; bo‘lmasa "".
Qoidalar: bo‘lakni kelishik qo‘shimchasiga emas, ma’no va bog‘lanishga qarab aniqla.
Daraja so‘zlari (eng, juda, nihoyatda, g‘oyat) sifat yoki ravish bilan birga bitta bo‘lak hosil qiladi: "eng katta" — ikkalasi ham aniqlovchi, "juda tez" ikkalasi hol; "head" — o‘sha sifat/ravish.
Undalma, kirish so‘z va yordamchi so‘zga so‘roq berilmaydi — "question" bo‘sh (""). Qo‘shma kesim yoki birikma bo‘lsa, har bir so‘zini o‘sha bo‘lak bilan belgila. Yashirin ega bo‘lsa, kesim izohida ayt.
Barcha matn o‘zbek lotin yozuvida. Ikkilanma, ehtimol, taxmin kabi so‘zlarni ishlatma — aniq javob ber.`;

const WORD_RE = /\p{L}+(?:['`‘’ʻʼ-]\p{L}+)*/gu;
const CACHE_DAYS = 30;
/** Ko‘rsatma o‘zgarsa oshiriladi — eski kesh yozuvlari qayta so‘raladi */
const PROMPT_VERSION = 3;
const cacheTag = () => `${AI_MODEL()}|v${PROMPT_VERSION}`;

export interface AiSentenceResult {
  words: string[];
  roles: Array<{ index: number; word: string; role: Role; pos: string; question: string; basis: "tahlil"; explanation: string; head?: number }>;
  summary: { maqsad: string; tuzilish: string; yoyiqlik: string; asos: string; izoh: string };
  links: Array<{ from: number; to: number; type: string }>;
  warnings: string[];
}

export function validateSentence(input: unknown): { sentence: string; words: string[] } {
  const sentence = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  const words = sentence.match(WORD_RE) ?? [];
  if (words.length < 2) throw new HttpError(400, "Gap tahlili uchun kamida ikki so‘zli gap kiriting.", "TOO_SHORT");
  if (words.length > 40 || sentence.length > 500) throw new HttpError(400, "Gap juda uzun (40 so‘zgacha). Qo‘shma gaplarni alohida tahlil qiling.", "TOO_LONG");
  return { sentence, words };
}

export function normalizeSentenceAi(words: string[], raw: unknown): AiSentenceResult {
  const items = (raw as { words?: unknown })?.words;
  if (!Array.isArray(items)) throw new HttpError(502, "Xizmat javobi kutilgan ko‘rinishda emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  const byIndex = new Map<number, { role: Role; pos: string; question: string; explanation: string; head: number }>();
  for (const it of items as Array<Record<string, unknown>>) {
    const i = Number(it.i);
    const role = String(it.role) as Role;
    if (!Number.isInteger(i) || i < 1 || i > words.length || !SENTENCE_ROLES.includes(role)) continue;
    byIndex.set(i - 1, { role, pos: String(it.pos ?? ""), question: String(it.question ?? ""), explanation: String(it.explanation ?? ""), head: Number(it.head) });
  }
  if (byIndex.size < words.length) throw new HttpError(502, "Xizmat javobi to‘liq emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  const roles: AiSentenceResult["roles"] = [];
  const links: AiSentenceResult["links"] = [];
  words.forEach((word, index) => {
    const r = byIndex.get(index)!;
    const head = Number.isInteger(r.head) && r.head >= 1 && r.head <= words.length && r.head - 1 !== index ? r.head - 1 : undefined;
    roles.push({ index, word, role: r.role, pos: r.pos, question: toTypographic(r.question), basis: "tahlil", explanation: toTypographic(r.explanation), head });
    if (head !== undefined && r.role !== "yordamchi") {
      const type = r.role === "ega" ? "predikativ" : r.role === "aniqlovchi" ? "moslashuv" : r.role === "to‘ldiruvchi" ? "boshqaruv" : "bitishuv";
      links.push({ from: index, to: head, type });
    }
  });
  const g = raw as Record<string, unknown>;
  const str = (v: unknown) => toTypographic(typeof v === "string" ? v : "");
  const summary = { maqsad: str(g.maqsad), tuzilish: str(g.tuzilish), yoyiqlik: str(g.yoyiqlik), asos: str(g.asos), izoh: str(g.izoh) };
  return { words, roles, links, summary, warnings: [] };
}

export async function analyzeSentenceAi(input: unknown, userId?: string | null): Promise<AiSentenceResult> {
  const { sentence, words } = validateSentence(input);
  const key = `gap:${normalizeKey(sentence)}`;
  const hit = await prisma.aiWordCache.findUnique({ where: { key } });
  const { model: cachedModel, ...cached } = (hit?.result ?? {}) as unknown as AiSentenceResult & { model?: string };
  if (hit && cachedModel === cacheTag() && hit.createdAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) return cached as AiSentenceResult;
  const numbered = `Gap: ${sentence}\nSo‘zlar:\n${words.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;
  const raw = await aiJson<unknown>(SENTENCE_PROMPT, numbered, SCHEMA, { maxTokens: 12000, effort: "high", usage: { feature: "analyze", userId } });
  const result = normalizeSentenceAi(words, raw);
  await prisma.aiWordCache.upsert({
    where: { key },
    create: { key, word: sentence.slice(0, 200), result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue },
    update: { word: sentence.slice(0, 200), result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue, createdAt: new Date() },
  });
  return result;
}
