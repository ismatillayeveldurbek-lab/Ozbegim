/**
 * Qoidaviy imlo tekshiruvi.
 *
 * Qamrov (ochiq aytiladi): to‘liq o‘zbek tili lug‘ati ulanmagan, shuning uchun noma’lum so‘zlar
 * xato deb belgilanmaydi. Tekshiruv faqat aniq qoidalar va bir ma’noli xatolar ro‘yxatiga
 * tayanadi. Ism-familiya, sheva birliklari va maxsus atamalar avtomatik xato hisoblanmaydi.
 */
import { APOSTROPHE_STYLES, type ApostropheStyle, isApostrophe, isCyrillicLetter, isLatinLetter, isUpper } from "../alphabet";
import { normalizeKey } from "../normalize";
import { findProtectedRanges } from "../protect";
import { transliterate } from "../translit";
import {
  ABBREVIATIONS,
  COMMA_CONJUNCTIONS,
  FUNCTION_WORDS,
  HYPHEN_PARTICLES,
  JOINED_COMPOUNDS,
  KNOWN_ERRORS,
  PAIR_WORDS,
  PROPER_NOUNS,
  type SuggestionType,
  TYPE_LABEL,
} from "./data";

export { TYPE_LABEL };
export type { SuggestionType };

export interface Suggestion {
  id: string;
  start: number;
  end: number;
  original: string;
  replacement: string;
  type: SuggestionType;
  message: string;
  confidence: "aniq" | "ehtimoliy";
  source: "qoida" | "lug‘at";
  /** Rad etilgan tavsiyalarni matn o‘zgargandan keyin ham tanish uchun imzo */
  signature: string;
}

export interface SpellingPairData {
  wrongKey: string;
  correct: string;
  note?: string | null;
}

export interface CheckOptions {
  punctuation?: boolean;
  /** Shaxsiy lug‘atdagi so‘zlar (normalizeKey ko‘rinishida) */
  ignore?: Set<string>;
  /** Bazadagi tasdiqlangan "xato → to‘g‘ri" juftliklari */
  pairs?: SpellingPairData[];
  /** Afzal ko‘rilgan apostrof uslubi; berilmasa, matnda ko‘p ishlatilgani olinadi */
  apostrophe?: ApostropheStyle;
}

interface Word {
  start: number;
  end: number;
  text: string;
  key: string;
  script: "latin" | "cyrillic" | "mixed";
}

const WORD_RE = /\p{L}+(?:['`‘’ʻʼ´]\p{L}+)*['`‘’ʻʼ´]?/gu;
const SUFFIXES = ["", "da", "dan", "ga", "ni", "ning", "lik", "lar", "dagi", "ning", "lari", "larda", "larga", "larni", "ga", "dek", "cha", "i", "si"];

const CYR_TO_LAT_LOOKALIKE: Record<string, string> = { а: "a", е: "e", о: "o", р: "p", х: "x", у: "y", А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", Т: "T", Х: "X" };
const LAT_TO_CYR_LOOKALIKE: Record<string, string> = Object.fromEntries(Object.entries(CYR_TO_LAT_LOOKALIKE).map(([c, l]) => [l, c]));

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function tokenizeWords(text: string): Word[] {
  const words: Word[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    let t = m[0];
    // So‘z oxiridagi apostrof faqat o/g dan keyin so‘zga tegishli (bog‘, tog‘); aks holda qo‘shtirnoq.
    if (isApostrophe(t[t.length - 1]) && !/[oOgG]/.test(t[t.length - 2])) t = t.slice(0, -1);
    const lat = [...t].some(isLatinLetter);
    const cyr = [...t].some(isCyrillicLetter);
    words.push({ start: m.index!, end: m.index! + t.length, text: t, key: normalizeKey(t), script: lat && cyr ? "mixed" : cyr ? "cyrillic" : "latin" });
  }
  return words;
}

/** Tavsiyani so‘z yozuviga moslaydi (kirill so‘z uchun kirillda). */
function inScript(replacement: string, script: Word["script"], style: ApostropheStyle): string {
  if (script === "cyrillic") return transliterate(replacement, { direction: "lat2cyr", protect: false }).text;
  return restyle(replacement, style);
}

/** Lotin matndagi apostroflarni tanlangan uslubga keltiradi. */
function restyle(s: string, style: ApostropheStyle): string {
  const { okina, tutuq } = APOSTROPHE_STYLES[style];
  return s.replace(/([oOgG])['`‘’ʻʼ´]/g, `$1${okina}`).replace(/['`‘’ʻʼ´]/g, (m, off: number, str: string) => (/[oOgG]/.test(str[off - 1]) ? m : tutuq));
}

function matchCase(source: string, replacement: string): string {
  if (source.length > 1 && source === source.toUpperCase() && source !== source.toLowerCase()) return replacement.toUpperCase();
  if (isUpper(source[0])) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function isSentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /[ \t"«“„'‘(]/.test(text[i])) i--;
  if (i < 0) return true;
  if (text[i] === "\n") return true;
  if (!/[.!?…]/.test(text[i])) return false;
  // Qisqartma yoki raqamli ro‘yxatdan keyin emasmi?
  let j = i - 1;
  while (j >= 0 && /[\p{L}\p{N}.'‘’ʻʼ]/u.test(text[j])) j--;
  const prev = normalizeKey(text.slice(j + 1, i));
  if (/^\d+$/.test(prev)) return false;
  if (ABBREVIATIONS.has(prev) || (prev.length === 1 && text[i] === ".")) return false;
  return true;
}

function detectStyle(text: string): ApostropheStyle {
  const counts: Record<ApostropheStyle, number> = { typographic: 0, unicode: 0, ascii: 0 };
  for (const m of text.matchAll(/[oOgG]([‘ʻ'])/g)) counts[m[1] === "‘" ? "typographic" : m[1] === "ʻ" ? "unicode" : "ascii"]++;
  const best = (Object.keys(counts) as ApostropheStyle[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[best] > 0 ? best : "typographic";
}

export function checkSpelling(text: string, opts: CheckOptions = {}): Suggestion[] {
  const out: Suggestion[] = [];
  const protectedRanges = findProtectedRanges(text);
  const isProtected = (s: number, e: number) => protectedRanges.some((r) => s < r.end && e > r.start);
  const ignore = opts.ignore ?? new Set<string>();
  const style = opts.apostrophe ?? detectStyle(text);
  const pairMap = new Map((opts.pairs ?? []).map((p) => [p.wrongKey, p]));

  const add = (s: Omit<Suggestion, "id" | "signature" | "original"> & { original?: string }) => {
    if (isProtected(s.start, s.end)) return;
    const original = s.original ?? text.slice(s.start, s.end);
    if (original === s.replacement) return;
    const ctx = text.slice(Math.max(0, s.start - 12), s.start);
    const signature = `${s.type}|${original}|${s.replacement}|${ctx}`;
    out.push({ ...s, original, id: hash(`${s.start}|${signature}`), signature });
  };

  const words = tokenizeWords(text);

  // 1. Aralash yozuv (bir so‘zda lotin va kirill harflari)
  for (const w of words) {
    if (w.script !== "mixed") continue;
    const lat = [...w.text].filter(isLatinLetter).length;
    const cyr = [...w.text].filter(isCyrillicLetter).length;
    const map = lat >= cyr ? CYR_TO_LAT_LOOKALIKE : LAT_TO_CYR_LOOKALIKE;
    const fixed = [...w.text].map((c) => map[c] ?? c).join("");
    const ok = lat >= cyr ? ![...fixed].some(isCyrillicLetter) : ![...fixed].some(isLatinLetter);
    if (ok)
      add({
        start: w.start,
        end: w.end,
        replacement: fixed,
        type: "aralash_yozuv",
        message: `So‘z ichida ${lat >= cyr ? "kirill" : "lotin"} harfi bor (ko‘rinishi bir xil, lekin boshqa belgi). Bu qidiruv va saralashni buzadi.`,
        confidence: "aniq",
        source: "qoida",
      });
  }

  // 2. O‘/G‘ va tutuq belgilari
  const pref = APOSTROPHE_STYLES[style];
  for (const w of words) {
    if (w.script !== "latin") continue;
    for (let i = w.start; i < w.end; i++) {
      const ch = text[i];
      if (!isApostrophe(ch)) continue;
      const isOkina = /[oOgG]/.test(text[i - 1]);
      const want = isOkina ? pref.okina : pref.tutuq;
      if (ch === want) continue;
      const bad = ch === "`" || ch === "´" || ch === "ʹ" || ch === "′";
      add({
        start: i,
        end: i + 1,
        replacement: want,
        type: isOkina ? "o_g_belgisi" : "tutuq",
        message: bad
          ? `“${ch}” belgisi ${isOkina ? "o‘/g‘ harfi" : "tutuq belgisi"} uchun mo‘ljallanmagan.`
          : isOkina
            ? `Matnda o‘/g‘ uchun asosan “${pref.okina}” ishlatilgan — bir xil belgidan foydalanish tavsiya etiladi.`
            : `Tutuq belgisi uchun “${pref.tutuq}” tavsiya etiladi (o‘/g‘ belgisidan farqli).`,
        confidence: bad ? "aniq" : "ehtimoliy",
        source: "qoida",
      });
    }
  }

  // 3. Lug‘at bo‘yicha xatolar, atoqli otlar, gap boshi
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    if (w.script === "mixed" || ignore.has(w.key)) continue;
    const capitalized = isUpper(w.text[0]);
    const sentenceStart = isSentenceStart(text, w.start);
    const known = KNOWN_ERRORS[w.key];
    const pair = pairMap.get(w.key);
    // Gap o‘rtasidagi bosh harfli so‘z — ism yoki atama bo‘lishi mumkin, tegmaymiz.
    const nameLike = capitalized && !sentenceStart;
    // Gap boshidagi kichik harfli so‘z tuzatilsa, bosh harf ham shu tavsiyaga qo‘shiladi.
    const fixCase = (r: string) => (sentenceStart && !capitalized ? r[0].toUpperCase() + r.slice(1) : matchCase(w.text, r));
    if (pair && !nameLike) {
      add({
        start: w.start,
        end: w.end,
        replacement: fixCase(inScript(pair.correct, w.script, style)),
        type: "imlo",
        message: pair.note || "Bazadagi tasdiqlangan yozilish bo‘yicha.",
        confidence: "aniq",
        source: "lug‘at",
      });
      continue;
    }
    if (known && !nameLike) {
      add({
        start: w.start,
        end: w.end,
        replacement: fixCase(inScript(known.correct, w.script, style)),
        type: known.type,
        message: known.note,
        confidence: known.confidence,
        source: "qoida",
      });
      continue;
    }
    if (!capitalized) {
      // Atoqli otlar (qo‘shimcha bilan ham): toshkentda → Toshkentda
      for (const [base, proper] of Object.entries(PROPER_NOUNS)) {
        if (w.key.startsWith(base) && SUFFIXES.includes(w.key.slice(base.length))) {
          add({
            start: w.start,
            end: w.start + 1,
            replacement: w.text[0].toUpperCase(),
            type: "katta_harf",
            message: `“${proper}” — atoqli ot, bosh harf bilan yoziladi.`,
            confidence: "aniq",
            source: "qoida",
          });
          break;
        }
      }
      if (sentenceStart && !out.some((s) => s.start === w.start && s.type === "katta_harf") && !/\p{Lu}/u.test(w.text.slice(1))) {
        add({
          start: w.start,
          end: w.start + 1,
          replacement: w.text[0].toUpperCase(),
          type: "katta_harf",
          message: "Gap bosh harf bilan boshlanadi.",
          confidence: "aniq",
          source: "qoida",
        });
      }
    }
  }

  // 4. Ikki so‘zli qoidalar: qo‘shib yozish, juft so‘zlar, takror, yuklamalar
  for (let wi = 0; wi + 1 < words.length; wi++) {
    const a = words[wi];
    const b = words[wi + 1];
    const between = text.slice(a.end, b.start);
    if (!/^[ \t]+$/.test(between)) continue;
    if (ignore.has(a.key) || ignore.has(b.key)) continue;

    for (const [twoWords, joined] of Object.entries(JOINED_COMPOUNDS)) {
      const [x, y] = twoWords.split(" ");
      if (a.key === x && b.key.startsWith(y) && SUFFIXES.includes(b.key.slice(y.length))) {
        add({
          start: a.start,
          end: b.end,
          replacement: a.text + b.text,
          type: "qoshib_yozish",
          message: `“${joined}” qo‘shma so‘z — qo‘shib yoziladi.`,
          confidence: "aniq",
          source: "qoida",
        });
      }
    }

    for (const [x, y] of PAIR_WORDS) {
      if (a.key === x && b.key.startsWith(y) && SUFFIXES.includes(b.key.slice(y.length))) {
        add({
          start: a.start,
          end: b.end,
          replacement: `${a.text}-${b.text}`,
          type: "chiziqcha",
          message: "Juft so‘zlar chiziqcha bilan yoziladi.",
          confidence: "aniq",
          source: "qoida",
        });
      }
    }

    if (a.key === b.key && a.key.length >= 2 && !/^\d/.test(a.key)) {
      if (FUNCTION_WORDS.has(a.key)) {
        add({
          start: a.start,
          end: b.end,
          replacement: a.text,
          type: "imlo",
          message: "So‘z ketma-ket ikki marta yozilgan.",
          confidence: "aniq",
          source: "qoida",
        });
      } else {
        add({
          start: a.start,
          end: b.end,
          replacement: `${a.text}-${b.text}`,
          type: "chiziqcha",
          message: "Takroriy so‘zlar chiziqcha bilan yoziladi (agar takror tasodifiy bo‘lsa, bittasini o‘chiring).",
          confidence: "ehtimoliy",
          source: "qoida",
        });
      }
    }

    if (HYPHEN_PARTICLES.has(b.key) && b.script !== "mixed") {
      add({
        start: a.end,
        end: b.start,
        replacement: "-",
        type: "chiziqcha",
        message: `“-${b.text}” yuklamasi oldingi so‘zga chiziqcha bilan qo‘shib yoziladi.`,
        confidence: "aniq",
        source: "qoida",
      });
    }
  }

  // 5. Bo‘shliqlar
  for (const m of text.matchAll(/(?<=\S)[ \t]{2,}(?=\S)/g))
    add({ start: m.index!, end: m.index! + m[0].length, replacement: " ", type: "bo_shliq", message: "Ortiqcha bo‘shliq.", confidence: "aniq", source: "qoida" });
  for (const m of text.matchAll(/(?<=\S)[ \t]+(?=[,.;:!?)\]»”])/g)) {
    if (/^\.{3}/.test(text.slice(m.index! + m[0].length))) continue;
    add({ start: m.index!, end: m.index! + m[0].length, replacement: "", type: "bo_shliq", message: "Tinish belgisidan oldin bo‘shliq qo‘yilmaydi.", confidence: "aniq", source: "qoida" });
  }
  for (const m of text.matchAll(/[(\[«“][ \t]+/g))
    add({ start: m.index! + 1, end: m.index! + m[0].length, replacement: "", type: "bo_shliq", message: "Ochuvchi qavs yoki qo‘shtirnoqdan keyin bo‘shliq qo‘yilmaydi.", confidence: "aniq", source: "qoida" });
  for (const m of text.matchAll(/[ \t]+(?=\r?\n|$)/g))
    if (m.index! > 0 && text[m.index! - 1] !== "\n")
      add({ start: m.index!, end: m.index! + m[0].length, replacement: "", type: "bo_shliq", message: "Qator oxirida ortiqcha bo‘shliq.", confidence: "aniq", source: "qoida" });
  for (const m of text.matchAll(/(?<!\d)([,;:!?])(?=\p{L})/gu))
    add({ start: m.index! + 1, end: m.index! + 1, original: "", replacement: " ", type: "bo_shliq", message: "Tinish belgisidan keyin bo‘shliq qo‘yiladi.", confidence: "aniq", source: "qoida" });
  for (const m of text.matchAll(/(?<=\p{Ll}{2,})\.(?=\p{Lu}\p{Ll})/gu))
    add({ start: m.index! + 1, end: m.index! + 1, original: "", replacement: " ", type: "bo_shliq", message: "Nuqtadan keyin bo‘shliq qo‘yiladi.", confidence: "ehtimoliy", source: "qoida" });

  // 6. Tinish belgilari (alohida yoqiladi)
  if (opts.punctuation) {
    for (const m of text.matchAll(/,{2,}|(?<!\.)\.\.(?!\.)|!{2,}|\?{2,}/g))
      add({
        start: m.index!,
        end: m.index! + m[0].length,
        replacement: m[0][0],
        type: "tinish",
        message: m[0][0] === "." ? "Ikki nuqta — bitta nuqta yoki uch nuqta (…) bo‘lishi kerak." : "Tinish belgisi takrorlangan.",
        confidence: m[0][0] === "," || m[0][0] === "." ? "aniq" : "ehtimoliy",
        source: "qoida",
      });
    for (let wi = 1; wi < words.length; wi++) {
      const w = words[wi];
      const prev = words[wi - 1];
      if (!COMMA_CONJUNCTIONS.has(w.key)) continue;
      const between = text.slice(prev.end, w.start);
      if (/^[ \t]+$/.test(between))
        add({
          start: prev.end,
          end: w.start,
          replacement: ", ",
          type: "tinish",
          message: `“${w.text}” bog‘lovchisidan oldin vergul qo‘yiladi.`,
          confidence: "aniq",
          source: "qoida",
        });
    }
    // Paragraf oxirida tinish belgisi yo‘q
    let offset = 0;
    for (const para of text.split(/\n/)) {
      const trimmed = para.replace(/\s+$/, "");
      const wordsCount = (trimmed.match(/\p{L}+/gu) ?? []).length;
      if (wordsCount >= 4 && /\p{L}$/u.test(trimmed)) {
        const pos = offset + trimmed.length;
        add({ start: pos, end: pos, original: "", replacement: ".", type: "tinish", message: "Gap oxirida tinish belgisi yo‘q.", confidence: "ehtimoliy", source: "qoida" });
      }
      offset += para.length + 1;
    }
  }

  // Ustma-ust tushgan tavsiyalardan birinchisi qoladi
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: Suggestion[] = [];
  let lastEnd = -1;
  for (const s of out) {
    const prev = result[result.length - 1];
    if (s.start < lastEnd) continue;
    if (prev && s.start === s.end && prev.start === prev.end && prev.start === s.start) continue;
    result.push(s);
    lastEnd = Math.max(lastEnd, s.end);
  }
  return result;
}

/**
 * Tavsiyani xavfsiz qo‘llash: matnning shu joyida hali ham asl parcha turgan bo‘lsa qo‘llanadi.
 * Aks holda null qaytadi (matn o‘zgargan — tavsiyalar qayta hisoblanishi kerak).
 */
export function applySuggestion(text: string, s: Pick<Suggestion, "start" | "end" | "original" | "replacement">): string | null {
  if (text.slice(s.start, s.end) !== s.original) return null;
  return text.slice(0, s.start) + s.replacement + text.slice(s.end);
}

/** Barcha tavsiyalarni oxiridan boshlab qo‘llaydi (oldingi indekslar siljimaydi). */
export function applyAll(text: string, list: Suggestion[]): { text: string; applied: number } {
  let t = text;
  let applied = 0;
  let minStart = Infinity;
  for (const s of [...list].sort((a, b) => b.start - a.start)) {
    if (s.end > minStart) continue;
    const next = applySuggestion(t, s);
    if (next === null) continue;
    t = next;
    applied++;
    minStart = s.start;
  }
  return { text: t, applied };
}
