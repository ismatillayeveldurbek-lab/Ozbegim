/**
 * O‘zbek alifbosi bo‘yicha umumiy konstantalar va yordamchi funksiyalar.
 */

/** Apostrof sifatida ishlatiladigan barcha belgilar (o‘, g‘ va tutuq uchun). */
export const APOSTROPHES = new Set(["'", "`", "‘", "’", "ʻ", "ʼ", "´", "ʹ", "′"]);

export function isApostrophe(ch: string | undefined): boolean {
  return ch !== undefined && APOSTROPHES.has(ch);
}

/** Natijada ishlatiladigan apostrof uslubi. */
export type ApostropheStyle = "typographic" | "unicode" | "ascii";

export const APOSTROPHE_STYLES: Record<ApostropheStyle, { okina: string; tutuq: string; label: string }> = {
  typographic: { okina: "‘", tutuq: "’", label: "o‘ va ’ (tipografik)" },
  unicode: { okina: "ʻ", tutuq: "ʼ", label: "oʻ va ʼ (rasmiy Unicode)" },
  ascii: { okina: "'", tutuq: "'", label: "o' va ' (oddiy klaviatura)" },
};

const LATIN_LETTER = /[A-Za-z]/;
const CYRILLIC_LETTER = /[Ѐ-ӿ]/;

export function isLatinLetter(ch: string | undefined): boolean {
  return ch !== undefined && LATIN_LETTER.test(ch);
}

export function isCyrillicLetter(ch: string | undefined): boolean {
  return ch !== undefined && CYRILLIC_LETTER.test(ch);
}

/** Har qanday harf (Unicode bo‘yicha). */
export function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && /\p{L}/u.test(ch);
}

export function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

export const LATIN_VOWELS = new Set(["a", "e", "i", "o", "u"]);
export const CYRILLIC_VOWELS = new Set(["а", "е", "ё", "и", "о", "у", "э", "ю", "я", "ў", "ы"]);

/** O‘zbek lotin alifbosidagi 29 harf (+ tutuq belgisi). */
export const UZ_LATIN_ALPHABET = [
  "a", "b", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "x", "y", "z",
  "o‘", "g‘", "sh", "ch", "ng",
];
