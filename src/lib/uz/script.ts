/**
 * Matn yozuvini aniqlash: lotin, kirill yoki aralash.
 */
import { isCyrillicLetter, isLatinLetter } from "./alphabet";

export type ScriptKind = "latin" | "cyrillic" | "mixed" | "none";

export interface ScriptReport {
  kind: ScriptKind;
  latinLetters: number;
  cyrillicLetters: number;
  /** Bir so‘z ichida ikkala yozuv harflari bor so‘zlar (masalan, kirill "о" bilan yozilgan lotin so‘z). */
  mixedWords: string[];
  latinWords: number;
  cyrillicWords: number;
  explanation: string;
}

/** Ozchilik yozuv ulushi shu chegaradan oshsa, matn aralash deb hisoblanadi. */
const MIXED_THRESHOLD = 0.15;

export function detectScript(text: string): ScriptReport {
  let latinLetters = 0;
  let cyrillicLetters = 0;
  let latinWords = 0;
  let cyrillicWords = 0;
  const mixedWords: string[] = [];

  for (const m of text.matchAll(/\p{L}+/gu)) {
    const w = m[0];
    let lat = 0;
    let cyr = 0;
    for (const ch of w) {
      if (isLatinLetter(ch)) lat++;
      else if (isCyrillicLetter(ch)) cyr++;
    }
    latinLetters += lat;
    cyrillicLetters += cyr;
    if (lat && cyr) {
      if (mixedWords.length < 50 && !mixedWords.includes(w)) mixedWords.push(w);
    } else if (lat) latinWords++;
    else if (cyr) cyrillicWords++;
  }

  const total = latinLetters + cyrillicLetters;
  let kind: ScriptKind;
  let explanation: string;
  if (total === 0) {
    kind = "none";
    explanation = "Matnda lotin yoki kirill harflari topilmadi.";
  } else {
    const minority = Math.min(latinLetters, cyrillicLetters) / total;
    if (minority > MIXED_THRESHOLD) {
      kind = "mixed";
      explanation =
        `Matnda ikkala yozuv ham bor: lotin harflari ${latinLetters} ta, kirill harflari ${cyrillicLetters} ta. ` +
        "O‘girish yo‘nalishini qo‘lda tanlang — tanlangan yozuvdagi qismlar o‘giriladi, boshqa yozuvdagi qismlar o‘zgarmaydi.";
    } else if (latinLetters >= cyrillicLetters) {
      kind = "latin";
      explanation = "Matn asosan lotin yozuvida.";
    } else {
      kind = "cyrillic";
      explanation = "Matn asosan kirill yozuvida.";
    }
  }
  if (mixedWords.length) {
    explanation +=
      ` ${mixedWords.length} ta so‘z ichida ikkala yozuv harflari aralashgan (masalan, “${mixedWords[0]}”). ` +
      "Bu ko‘pincha klaviaturani almashtirishda yuzaga keladi; bunday so‘zlarni tekshiring.";
  }

  return { kind, latinLetters, cyrillicLetters, mixedWords, latinWords, cyrillicWords, explanation };
}
