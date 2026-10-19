/**
 * O‘zbek tili: lotin ↔ kirill transliteratsiyasi.
 *
 * Qoidalar docs/TRANSLITERATSIYA.md faylida hujjatlashtirilgan. Asosiy tamoyillar:
 * — har bir chiqish bo‘lagi (token) manba matndagi oralig‘ini biladi; bu DOCX/PPTX
 *   run’lari orasida bo‘lingan "S|h" kabi birikmalarni to‘g‘ri joylashtirish uchun kerak;
 * — himoyalangan parchalar (URL, email, kod, formula, {{belgilangan}}) o‘zgarmaydi;
 * — transliteratsiya har doim ham qaytariladigan emas: ismlar, qisqartmalar,
 *   istisnolar va "ц" kabi holatlar "Tekshirish tavsiya etiladi" belgisini oladi.
 */
import {
  APOSTROPHE_STYLES,
  type ApostropheStyle,
  isApostrophe,
  isCyrillicLetter,
  isLatinLetter,
  isLetter,
  isUpper,
} from "./alphabet";
import { DEFAULT_PROTECT, findProtectedRanges, type ProtectOptions, type ProtectedRange } from "./protect";
import { findLatinException } from "./translit-exceptions";

export type Direction = "lat2cyr" | "cyr2lat";

export interface TranslitOptions {
  direction: Direction;
  apostrophe?: ApostropheStyle;
  /** false — hech narsa himoyalanmaydi. */
  protect?: ProtectOptions | false;
  /** Tokenlar ro‘yxatini qaytarish (fayl formatlari uchun). */
  withTokens?: boolean;
}

export interface Token {
  srcStart: number;
  srcEnd: number;
  out: string;
}

export type FlagReason =
  | "name"
  | "abbreviation"
  | "exception"
  | "ts"
  | "tse"
  | "shcha"
  | "foreign_letters"
  | "mixed_script"
  | "quote_apostrophe";

export interface TranslitFlag {
  start: number;
  end: number;
  word: string;
  reason: FlagReason;
  message: string;
}

export interface TranslitResult {
  text: string;
  tokens?: Token[];
  flags: TranslitFlag[];
  protectedRanges: ProtectedRange[];
}

export const FLAG_MESSAGES: Record<FlagReason, string> = {
  name: "Atoqli ot (ism, joy nomi) bo‘lishi mumkin — yozilishini tekshiring.",
  abbreviation: "Qisqartma bo‘lishi mumkin — ba’zi qisqartmalar o‘girilmaydi.",
  exception: "O‘zlashma so‘z istisnolar ro‘yxati bo‘yicha o‘girildi — tekshirish tavsiya etiladi.",
  ts: "“ts” birikmasi kirillda “ц” bo‘lishi mumkin — tekshirish tavsiya etiladi.",
  tse: "“ц” harfi lotinda so‘z boshida va undoshdan keyin “s”, unlidan keyin “ts” bo‘ladi — tekshiring.",
  shcha: "“щ” harfi o‘zbek lotin alifbosida yo‘q, “sh” deb yozildi — tekshiring.",
  foreign_letters: "So‘zda o‘zbek alifbosiga kirmaydigan harflar bor (xorijiy so‘z bo‘lishi mumkin).",
  mixed_script: "So‘z ichida lotin va kirill harflari aralashgan.",
  quote_apostrophe: "Apostrof qo‘shtirnoq o‘rnida ishlatilgan bo‘lishi mumkin — tekshiring.",
};

const L2C: Record<string, string> = {
  a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з",
};

const Y_VOWELS: Record<string, string> = { o: "ё", u: "ю", a: "я", e: "е" };

const C2L: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ч: "ch",
  ш: "sh", щ: "sh", ы: "i", э: "e", ю: "yu", я: "ya", ё: "yo", қ: "q", ҳ: "h", ь: "",
};

const LATIN_VOWEL = new Set(["a", "e", "i", "o", "u"]);
const CYR_VOWEL = new Set(["а", "е", "ё", "и", "о", "у", "э", "ю", "я", "ў", "ы"]);
const SENTENCE_END = /[.!?…\n]/;

function applyCase(out: string, upper: boolean, allCaps: boolean): string {
  if (!upper || !out) return out;
  if (allCaps) return out.toUpperCase();
  return out[0].toUpperCase() + out.slice(1);
}

/** So‘z gap boshida turibdimi (oldida faqat bo‘shliq/qo‘shtirnoq va undan oldin gap oxiri)? */
function isSentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /[\s"«“„'‘(\[—–-]/.test(text[i])) {
    if (text[i] === "\n") return true;
    i--;
  }
  if (i < 0) return true;
  return SENTENCE_END.test(text[i]) || text[i] === ":";
}

interface WordSpan {
  start: number;
  end: number;
}

/**
 * Lotin so‘zlarini ajratish: harflar va so‘z ichidagi apostroflar.
 * So‘z oxiridagi apostrof faqat o/g dan keyin so‘zga qo‘shiladi ("bog‘", "tog‘").
 */
function nextLatinWord(text: string, from: number, limit: number): WordSpan | null {
  let i = from;
  while (i < limit && !isLetter(text[i])) i++;
  if (i >= limit) return null;
  const start = i;
  while (i < limit) {
    const ch = text[i];
    if (isLetter(ch)) {
      i++;
      continue;
    }
    if (isApostrophe(ch) && i > start) {
      const prev = text[i - 1];
      const next = i + 1 < limit ? text[i + 1] : undefined;
      if (isLetter(next) || /[oOgG]/.test(prev)) {
        i++;
        continue;
      }
    }
    break;
  }
  return { start, end: i };
}

function nextCyrillicWord(text: string, from: number, limit: number): WordSpan | null {
  let i = from;
  while (i < limit && !isLetter(text[i])) i++;
  if (i >= limit) return null;
  const start = i;
  while (i < limit && isLetter(text[i])) i++;
  return { start, end: i };
}

interface Ctx {
  tokens: Token[];
  flags: TranslitFlag[];
  okina: string;
  tutuq: string;
  text: string;
}

function pushToken(ctx: Ctx, srcStart: number, srcEnd: number, out: string) {
  ctx.tokens.push({ srcStart, srcEnd, out });
}

function flag(ctx: Ctx, span: WordSpan, reason: FlagReason) {
  if (ctx.flags.some((f) => f.start === span.start && f.reason === reason)) return;
  ctx.flags.push({
    start: span.start,
    end: span.end,
    word: ctx.text.slice(span.start, span.end),
    reason,
    message: FLAG_MESSAGES[reason],
  });
}

function wordCaseInfo(word: string) {
  const letters = [...word].filter((c) => isLetter(c));
  const uppers = letters.filter((c) => isUpper(c));
  const allCaps = letters.length > 1 && uppers.length === letters.length;
  const capitalized = letters.length > 0 && isUpper(letters[0]) && !allCaps;
  return { allCaps, capitalized, letterCount: letters.length };
}

function commonFlags(ctx: Ctx, span: WordSpan, word: string) {
  const { allCaps, capitalized, letterCount } = wordCaseInfo(word);
  if (allCaps && letterCount >= 2 && letterCount <= 6) flag(ctx, span, "abbreviation");
  else if (capitalized && !isSentenceStart(ctx.text, span.start)) flag(ctx, span, "name");
  const hasLat = [...word].some(isLatinLetter);
  const hasCyr = [...word].some(isCyrillicLetter);
  if (hasLat && hasCyr) flag(ctx, span, "mixed_script");
}

function convertLatinWord(ctx: Ctx, span: WordSpan) {
  const { text } = ctx;
  const word = text.slice(span.start, span.end);
  const { allCaps } = wordCaseInfo(word);
  commonFlags(ctx, span, word);

  let i = span.start;
  let prevVowel = false;
  let atStart = true;

  // Istisno o‘zaklar (faqat apostrofsiz so‘zlar uchun).
  if (![...word].some((c) => isApostrophe(c))) {
    const exc = findLatinException(word.toLowerCase());
    if (exc) {
      const upper = isUpper(word[0]);
      pushToken(ctx, i, i + exc.stem.length, applyCase(exc.cyrillic, upper, allCaps));
      flag(ctx, span, "exception");
      i += exc.stem.length;
      prevVowel = CYR_VOWEL.has(exc.cyrillic[exc.cyrillic.length - 1]);
      atStart = false;
    }
  }

  if (/ts/i.test(word)) flag(ctx, span, "ts");

  while (i < span.end) {
    const c = text[i];
    const l = c.toLowerCase();
    const up = isUpper(c);
    const next = i + 1 < span.end ? text[i + 1] : undefined;
    const nl = next?.toLowerCase();

    if ((l === "o" || l === "g") && isApostrophe(next)) {
      // o‘ / g‘
      if (i === span.start && i > 0 && isApostrophe(text[i - 1]) && i + 2 >= span.end) flag(ctx, span, "quote_apostrophe");
      pushToken(ctx, i, i + 2, applyCase(l === "o" ? "ў" : "ғ", up, allCaps));
      prevVowel = l === "o";
      i += 2;
    } else if ((l === "s" || l === "c") && nl === "h") {
      pushToken(ctx, i, i + 2, applyCase(l === "s" ? "ш" : "ч", up, allCaps));
      prevVowel = false;
      i += 2;
    } else if (l === "s" && isApostrophe(next) && text[i + 2]?.toLowerCase() === "h") {
      // Is'hoq → Исҳоқ: apostrof s va h ni ajratadi, o‘zi tushib qoladi.
      pushToken(ctx, i, i + 2, applyCase("с", up, allCaps));
      prevVowel = false;
      i += 2;
    } else if (l === "y" && nl && Y_VOWELS[nl] && !(nl === "o" && isApostrophe(text[i + 2]))) {
      pushToken(ctx, i, i + 2, applyCase(Y_VOWELS[nl], up, allCaps));
      prevVowel = true;
      i += 2;
    } else if (l === "e") {
      pushToken(ctx, i, i + 1, applyCase(atStart || prevVowel ? "э" : "е", up, allCaps));
      prevVowel = true;
      i += 1;
    } else if (isApostrophe(c)) {
      // So‘z ichidagi tutuq belgisi
      pushToken(ctx, i, i + 1, "ъ");
      prevVowel = false;
      i += 1;
    } else if (L2C[l]) {
      pushToken(ctx, i, i + 1, applyCase(L2C[l], up, allCaps));
      prevVowel = LATIN_VOWEL.has(l);
      i += 1;
    } else {
      // Kirill yoki o‘zbek alifbosiga kirmaydigan harf (c, w ...) — o‘zgarmaydi.
      if (isLatinLetter(c)) flag(ctx, span, "foreign_letters");
      pushToken(ctx, i, i + 1, c);
      prevVowel = false;
      i += 1;
    }
    atStart = false;
  }
}

function convertCyrillicWord(ctx: Ctx, span: WordSpan) {
  const { text, okina, tutuq } = ctx;
  const word = text.slice(span.start, span.end);
  const { allCaps } = wordCaseInfo(word);
  commonFlags(ctx, span, word);

  let prevVowel = false;
  let prevSign = false;
  let lastOut = "";
  for (let i = span.start; i < span.end; i++) {
    const c = text[i];
    const l = c.toLowerCase();
    const up = isUpper(c);
    const atStart = i === span.start;
    const next = i + 1 < span.end ? text[i + 1].toLowerCase() : undefined;
    let out: string;

    switch (l) {
      case "е":
        out = atStart || prevVowel || prevSign ? "ye" : "e";
        break;
      case "ц":
        out = atStart || !prevVowel ? "s" : "ts";
        flag(ctx, span, "tse");
        break;
      case "щ":
        out = "sh";
        flag(ctx, span, "shcha");
        break;
      case "ъ":
        out = !prevVowel && next && "еёюя".includes(next) ? "" : tutuq;
        break;
      case "ў":
        out = "o" + okina;
        break;
      case "ғ":
        out = "g" + okina;
        break;
      case "ҳ":
        // Исҳоқ → Is’hoq: "sh" bilan adashmasligi uchun ajratuvchi belgi.
        out = lastOut.toLowerCase().endsWith("s") ? tutuq + "h" : "h";
        break;
      default:
        out = C2L[l] ?? c;
        if (!(l in C2L) && isLatinLetter(c)) {
          // Kirill so‘z ichidagi lotin harfi — o‘zgarmaydi.
          out = c;
        }
    }

    if (l in C2L || "ецщъўғҳ".includes(l)) out = applyCase(out, up, allCaps);
    pushToken(ctx, i, i + 1, out);
    if (out) lastOut = out;
    prevVowel = CYR_VOWEL.has(l);
    prevSign = l === "ъ" || l === "ь";
  }
}

/** Matnni lotin ↔ kirill yo‘nalishida o‘giradi. */
export function transliterate(text: string, options: TranslitOptions): TranslitResult {
  const style = APOSTROPHE_STYLES[options.apostrophe ?? "typographic"];
  const protectedRanges =
    options.protect === false ? [] : findProtectedRanges(text, options.protect ?? DEFAULT_PROTECT);
  const ctx: Ctx = { tokens: [], flags: [], okina: style.okina, tutuq: style.tutuq, text };
  const lat = options.direction === "lat2cyr";

  let pos = 0;
  const segments: Array<{ start: number; end: number; range?: ProtectedRange }> = [];
  for (const r of protectedRanges) {
    if (r.start > pos) segments.push({ start: pos, end: r.start });
    segments.push({ start: r.start, end: r.end, range: r });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ start: pos, end: text.length });

  for (const seg of segments) {
    if (seg.range) {
      pushToken(ctx, seg.start, seg.end, seg.range.output);
      continue;
    }
    let i = seg.start;
    while (i < seg.end) {
      const span = lat ? nextLatinWord(text, i, seg.end) : nextCyrillicWord(text, i, seg.end);
      if (!span) {
        pushToken(ctx, i, seg.end, text.slice(i, seg.end));
        break;
      }
      if (span.start > i) pushToken(ctx, i, span.start, text.slice(i, span.start));
      if (lat) convertLatinWord(ctx, span);
      else convertCyrillicWord(ctx, span);
      i = span.end;
    }
  }

  let out = "";
  for (const t of ctx.tokens) out += t.out;
  ctx.flags.sort((a, b) => a.start - b.start);
  return {
    text: out,
    tokens: options.withTokens ? ctx.tokens : undefined,
    flags: ctx.flags,
    protectedRanges,
  };
}

export function latinToCyrillic(text: string, options: Omit<TranslitOptions, "direction"> = {}): string {
  return transliterate(text, { ...options, direction: "lat2cyr" }).text;
}

export function cyrillicToLatin(text: string, options: Omit<TranslitOptions, "direction"> = {}): string {
  return transliterate(text, { ...options, direction: "cyr2lat" }).text;
}
