/**
 * So‘z tarkibi (morfemika) tahlili tashqi xizmat orqali: o‘zak, qo‘shimchalar va ularning turi/vazifasi, so‘z turkumi, ma’no.
 * Natija qoidaviy tahlil bilan bir xil ko‘rinishda qaytadi. AiWordCache’da "tarkib:" kaliti bilan 30 kun saqlanadi.
 */
import type { Prisma } from "@generated/prisma/client";
import { toTypographic } from "@/lib/uz/alphabet";
import { normalizeKey } from "@/lib/uz/normalize";
import { AI_MODEL, aiJson } from "./ai";
import { prisma } from "./db";
import { HttpError } from "./http";

const KINDS = ["so‘z yasovchi", "lug‘aviy shakl yasovchi", "sintaktik shakl yasovchi"] as const;
const POS = ["ot", "sifat", "son", "olmosh", "fe’l", "ravish", "ko‘makchi", "bog‘lovchi", "yuklama", "undov", "modal so‘z", "taqlid so‘z"] as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["analyses"],
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["root", "pos", "meaning", "affixes", "note"],
        properties: {
          root: { type: "string" },
          pos: { type: "string", enum: [...POS] },
          meaning: { type: "string" },
          note: { type: "string" },
          affixes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["form", "kind", "name"],
              properties: { form: { type: "string" }, kind: { type: "string", enum: [...KINDS] }, name: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

export const MORPH_PROMPT = `Sen o‘zbek tili morfemikasi va morfologiyasi bo‘yicha mutaxassis o‘qituvchisan. Berilgan so‘zni maktab grammatikasi bo‘yicha tarkibiga ajrat.
Qoidalar:
- "root" — o‘zak (lug‘aviy asos), o‘zbek lotin yozuvida, masalan "kitob", "o‘qi", "yaxshi". O‘zakda tovush o‘zgarishi bo‘lsa (yurak → yuragi, o‘rin → o‘rni), o‘zakni lug‘aviy shaklida yoz va "note"da ayt.
- "affixes" — o‘zakdan keyingi qo‘shimchalar tartib bilan: "form" — qo‘shimchaning o‘zi (chiziqchasiz, masalan "lar", "imiz", "dan"), "kind" — so‘z yasovchi, lug‘aviy shakl yasovchi (ko‘plik, kichraytirish, nisbat, bo‘lishsizlik, sifatdosh/ravishdosh/harakat nomi va h.k.) yoki sintaktik shakl yasovchi (kelishik, egalik, shaxs-son, zamon, mayl), "name" — aniq vazifasi, masalan "ko‘plik qo‘shimchasi", "1-shaxs ko‘plik egalik qo‘shimchasi", "chiqish kelishigi".
- O‘zakning o‘zi bo‘lgan so‘zlarni (masalan, "masalan", "lekin", "albatta", "kitob") qo‘shimchaga bo‘lma — "affixes": [].
- O‘zlashma va tub so‘zlarni soxta qo‘shimchalarga ajratma: "masalan" — modal so‘z (arabcha), "masa"+"lan" emas.
- "pos" — BUTUN so‘zning turkumi, o‘zakniki emas: yasama so‘zda yasovchi qo‘shimcha hosil qilgan turkum ("o‘qituvchi" — ot, "chiroyli" — sifat, "ishla" — fe’l);
  sifatdosh, ravishdosh, harakat nomi — fe’l. "meaning" — butun so‘zning qisqa lug‘aviy ma’nosi (yasama bo‘lsa, yasalgan so‘zniki).
- Omonimlarni (bir xil yozilgan, ma’nosi boshqa) faqat turkumi yoki tuzilishi farq qilsa alohida tahlil qil; bir turkumdagi turli ma’nolarni bitta tahlilning "meaning"ida "1) …; 2) …" deb ber.
- So‘z haqiqatan ham ikki xil tuzilish yoki turkumda bo‘lishi mumkin bo‘lsa (masalan, "ot" — ot/fe’l, "uchar"), har birini alohida tahlil sifatida ber, eng keng tarqalganini birinchi; aks holda faqat bitta tahlil.
- "note" — ixtiyoriy izoh (tovush o‘zgarishi, qo‘llanish) yoki "".
Barcha matn o‘zbek lotin yozuvida. Aniq javob ber.`;

export interface MorphResult {
  analyses: Array<{ root: string; pos: string; inferredPos: string; meaning: string; affixes: Array<{ form: string; kind: string; name: string }>; basis: "tahlil"; note?: string }>;
}

const CACHE_DAYS = 30;
const PROMPT_VERSION = 2;
const cacheTag = () => `${AI_MODEL()}|v${PROMPT_VERSION}`;

export async function analyzeMorphAi(input: unknown, userId?: string | null): Promise<MorphResult> {
  const word = typeof input === "string" ? input.trim().split(/\s+/)[0] ?? "" : "";
  if (!word || word.length > 60 || !/^[\p{L}'`‘’ʻʼ-]+$/u.test(word)) throw new HttpError(400, "Bitta so‘z kiriting (faqat harflar).", "BAD_WORD");
  const key = `tarkib:${normalizeKey(word)}`;
  const hit = await prisma.aiWordCache.findUnique({ where: { key } });
  const { model: tag, ...cached } = (hit?.result ?? {}) as unknown as MorphResult & { model?: string };
  if (hit && tag === cacheTag() && hit.createdAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) return cached as MorphResult;
  const raw = await aiJson<{ analyses?: Array<Record<string, unknown>> }>(MORPH_PROMPT, word, SCHEMA, { maxTokens: 4000, effort: "high", usage: { feature: "word", userId } });
  const t = (v: unknown) => toTypographic(typeof v === "string" ? v.trim() : "");
  const analyses = (raw.analyses ?? []).slice(0, 3).map((a) => ({
    root: t(a.root) || word,
    pos: t(a.pos),
    inferredPos: t(a.pos),
    meaning: t(a.meaning),
    affixes: (Array.isArray(a.affixes) ? a.affixes : [])
      .map((x: Record<string, unknown>) => ({ form: t(x.form).replace(/^-+/, ""), kind: t(x.kind), name: t(x.name) }))
      .filter((x) => x.form),
    basis: "tahlil" as const,
    note: t(a.note) || undefined,
  }));
  if (!analyses.length) throw new HttpError(502, "Xizmat javobi to‘liq emas. Qayta urinib ko‘ring.", "AI_BAD_SHAPE");
  const result: MorphResult = { analyses };
  await prisma.aiWordCache.upsert({
    where: { key },
    create: { key, word, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue },
    update: { word, result: { ...result, model: cacheTag() } as unknown as Prisma.InputJsonValue, createdAt: new Date() },
  });
  return result;
}
