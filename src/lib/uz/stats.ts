/**
 * Matn statistikasi. Har bir ko‘rsatkich qanday hisoblangani STATS_METHOD da tushuntirilgan.
 * Ilmiy asoslanmagan baholar (masalan, "savodxonlik darajasi") hisoblanmaydi.
 */
import { isCyrillicLetter, isLatinLetter } from "./alphabet";
import { normalizeKey } from "./normalize";

const WORD_RE = /[\p{L}\p{N}]+(?:['`‘’ʻʼ-][\p{L}\p{N}]+)*/gu;
const FUNCTION_WORDS = new Set(["va", "bilan", "ham", "bu", "shu", "u", "uchun", "esa", "lekin", "ammo", "bir", "da", "ni", "ning", "deb", "edi", "ekan", "emas", "yoki", "har", "o'sha", "agar"]);

export interface TextStats {
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  avgWordLength: number;
  topWords: Array<{ word: string; count: number }>;
  script: { latinWords: number; cyrillicWords: number; mixedWords: number; otherWords: number; mixedList: string[] };
}

export function textStats(text: string, opts: { skipFunctionWords?: boolean; top?: number } = {}): TextStats {
  const chars = [...text];
  const words = text.match(WORD_RE) ?? [];
  const counts = new Map<string, { word: string; count: number }>();
  let latinWords = 0;
  let cyrillicWords = 0;
  let mixedWords = 0;
  let otherWords = 0;
  const mixedList: string[] = [];
  let letterTotal = 0;
  for (const w of words) {
    const lat = [...w].some(isLatinLetter);
    const cyr = [...w].some(isCyrillicLetter);
    if (lat && cyr) {
      mixedWords++;
      if (mixedList.length < 20 && !mixedList.includes(w)) mixedList.push(w);
    } else if (lat) latinWords++;
    else if (cyr) cyrillicWords++;
    else otherWords++;
    letterTotal += [...w].length;
    if (/^\d+$/.test(w)) continue;
    const key = normalizeKey(w);
    if (opts.skipFunctionWords && FUNCTION_WORDS.has(key)) continue;
    const e = counts.get(key);
    if (e) e.count++;
    else counts.set(key, { word: w.toLowerCase(), count: 1 });
  }
  const sentences = text
    .replace(/\b(t\.b|h\.k|m\.|y\.)/gi, "")
    .split(/[.!?…]+(?=\s|$)|\n\s*\n/)
    .filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
  const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  return {
    charsWithSpaces: chars.length,
    charsWithoutSpaces: chars.filter((c) => !/\s/.test(c)).length,
    words: words.length,
    uniqueWords: counts.size,
    sentences,
    paragraphs,
    avgWordLength: words.length ? Math.round((letterTotal / words.length) * 10) / 10 : 0,
    topWords: [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, opts.top ?? 15),
    script: { latinWords, cyrillicWords, mixedWords, otherWords, mixedList },
  };
}

export const STATS_METHOD = [
  "Belgilar — barcha Unicode belgilar (harf, raqam, tinish, bo‘shliq); “bo‘shliqlarsiz” sanoqda bo‘shliq, tab va qator ko‘chishi chiqarib tashlanadi.",
  "So‘z — harf va raqamlarning uzluksiz ketma-ketligi; so‘z ichidagi apostrof (o‘, tutuq) va chiziqcha so‘zni bo‘lmaydi (“ota-ona” — bitta so‘z).",
  "Gap — nuqta, so‘roq, undov yoki ko‘p nuqta bilan tugagan (yoki bo‘sh qator bilan ajralgan) qism. “t.b.”, “h.k.” kabi qisqartmalar hisobga olinmaydi; boshqa qisqartmalar natijani biroz o‘zgartirishi mumkin.",
  "Paragraf — kamida bitta harf yoki raqam bo‘lgan har bir qator.",
  "Eng ko‘p takrorlangan so‘zlar — katta-kichik harf, lotin/kirill va apostrof farqlari birlashtirilib sanaladi (“Ўзбек” va “o‘zbek” — bitta so‘z).",
  "Yozuv tarkibi — har bir so‘z harflariga qarab lotin, kirill yoki aralash (bir so‘zda ikkala yozuv) deb belgilanadi.",
];
