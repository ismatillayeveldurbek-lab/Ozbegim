/**
 * Qidiruv uchun normallashtirish.
 *
 * Kalit: lotin yozuvi, kichik harflar, apostrofning yagona ko‘rinishi ('), bitta bo‘shliq.
 * Shuning uchun "O‘zbekiston", "o'zbekiston", "oʻzbekiston" va "Ўзбекистон" bitta kalitga tushadi.
 *
 * Ataylab BIRLASHTIRILMAYDIGAN holatlar (turli so‘zlar):
 *  — apostrofli va apostrofsiz shakllar: "so‘z" ≠ "soz", "o‘q" ≠ "oq", "ma’no" ≠ "mano";
 *  — x va h: "xol" ≠ "hol"; kirill "у" va "ў": "ук" ≠ "ўқ".
 */
import { isApostrophe, isCyrillicLetter } from "./alphabet";
import { transliterate } from "./translit";

export function normalizeKey(input: string): string {
  let s = input.normalize("NFC").trim();
  if (!s) return "";
  if ([...s].some(isCyrillicLetter)) {
    s = transliterate(s, { direction: "cyr2lat", apostrophe: "ascii", protect: false }).text;
  }
  s = s.toLowerCase();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (isApostrophe(ch)) {
      // So‘z ichidagi yoki o/g dan keyingi apostrof saqlanadi (yagona ko‘rinishda).
      const prev = s[i - 1];
      if (prev && /\p{L}/u.test(prev)) out += "'";
      continue;
    }
    if (/[‐‑‒–—―]/.test(ch)) {
      out += "-";
      continue;
    }
    if (/[\p{L}\p{N}\s-]/u.test(ch)) out += ch;
    else out += " ";
  }
  return out.replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
}

/** Qidiruv so‘rovini tekshirish: bo‘sh yoki juda uzun bo‘lmasin. */
export function isValidQuery(q: string): boolean {
  const k = normalizeKey(q);
  return k.length >= 1 && k.length <= 120;
}
