/**
 * Transliteratsiya paytida o‘zgarmasligi kerak bo‘lgan parchalarni aniqlash:
 * URL, elektron pochta, kod bloklari, inline kod, formulalar va foydalanuvchi
 * {{belgilagan}} parchalar.
 */

export type ProtectKind = "url" | "email" | "code" | "formula" | "marker";

export interface ProtectOptions {
  urls?: boolean;
  emails?: boolean;
  code?: boolean;
  formulas?: boolean;
  markers?: boolean;
}

export interface ProtectedRange {
  start: number;
  end: number;
  kind: ProtectKind;
  /** Natijaga chiqariladigan matn (masalan, {{ }} belgilarisiz). */
  output: string;
}

export const DEFAULT_PROTECT: Required<ProtectOptions> = {
  urls: true,
  emails: true,
  code: true,
  formulas: true,
  markers: true,
};

export const PROTECT_LABELS: Record<ProtectKind, string> = {
  url: "Havola",
  email: "Elektron pochta",
  code: "Kod",
  formula: "Formula",
  marker: "Belgilangan parcha",
};

const TRAILING_CHARS = ".,;:!?'\"»”’)]}";
const COMMON_TLDS = "uz|com|ru|org|net|io|gov|edu|info|tj|kz|kg|tm|tr|de|uk|us|app|dev|me|tv";

/** URL oxiridagi tinish belgilarini olib tashlaydi; URL ichidagi juft qavslarni saqlaydi. */
export function trimUrl(raw: string): string {
  let url = raw;
  while (url.length) {
    const last = url[url.length - 1];
    if (!TRAILING_CHARS.includes(last)) break;
    if (last === ")") {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (opens >= closes) break;
    }
    url = url.slice(0, -1);
  }
  return url;
}

function overlaps(ranges: ProtectedRange[], start: number, end: number): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

function add(ranges: ProtectedRange[], start: number, end: number, kind: ProtectKind, output: string) {
  if (end <= start || overlaps(ranges, start, end)) return;
  ranges.push({ start, end, kind, output });
}

export function findProtectedRanges(text: string, options: ProtectOptions = DEFAULT_PROTECT): ProtectedRange[] {
  const opts = { ...DEFAULT_PROTECT, ...options };
  const ranges: ProtectedRange[] = [];

  if (opts.code) {
    // Yopilgan ``` ... ``` kod bloklari (yopilmagan blok oddiy matn sifatida qoladi).
    for (const m of text.matchAll(/```[\s\S]*?```/g)) {
      add(ranges, m.index!, m.index! + m[0].length, "code", m[0]);
    }
  }

  if (opts.markers) {
    for (const m of text.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      add(ranges, m.index!, m.index! + m[0].length, "marker", m[1]);
    }
  }

  if (opts.formulas) {
    for (const m of text.matchAll(/\$\$[\s\S]+?\$\$/g)) add(ranges, m.index!, m.index! + m[0].length, "formula", m[0]);
    for (const m of text.matchAll(/\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g))
      add(ranges, m.index!, m.index! + m[0].length, "formula", m[0]);
    // $...$: ochuvchi $ dan keyin bo‘shliq yo‘q, yopuvchidan oldin bo‘shliq yo‘q, keyin raqam yo‘q ("$5 va $10" narx emas).
    for (const m of text.matchAll(/(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\d$])/g)) {
      add(ranges, m.index!, m.index! + m[0].length, "formula", m[0]);
    }
    // Jadval formulasi: qator "=" bilan boshlanib, ichida qavs bo‘lsa (=SUM(A1:A3)) yoki bo‘shliqsiz (=A1*2).
    for (const m of text.matchAll(/(^|\n)(=[A-Za-z_$][^\n]*\([^\n]*|=[A-Za-z_$][^\s]*(?=\n|$))/g)) {
      const start = m.index! + m[1].length;
      add(ranges, start, start + m[2].length, "formula", m[2]);
    }
  }

  if (opts.code) {
    // Inline kod: `...`. Ochuvchi ` harfdan keyin kelmasin (o`zbek, g`alaba kabi yozuvlar kod emas).
    for (const m of text.matchAll(/(?<![\p{L}\p{N}`])`(?=[^\s`])([^`\n]+?)(?<=[^\s`])`(?![\p{L}\p{N}`])/gu)) {
      add(ranges, m.index!, m.index! + m[0].length, "code", m[0]);
    }
  }

  if (opts.emails) {
    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
      add(ranges, m.index!, m.index! + m[0].length, "email", m[0]);
    }
  }

  if (opts.urls) {
    for (const m of text.matchAll(/\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"«»]+/gi)) {
      const url = trimUrl(m[0]);
      add(ranges, m.index!, m.index! + url.length, "url", url);
    }
    // Protokolsiz domenlar: kun.uz, gazeta.uz/uz/news
    const bare = new RegExp(
      `(?<![\\p{L}\\p{N}@./-])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9-]+)*\\.(?:${COMMON_TLDS})(?![\\p{L}\\p{N}])(?:\\/[^\\s<>"«»]*)?`,
      "gu",
    );
    for (const m of text.matchAll(bare)) {
      const url = trimUrl(m[0]);
      add(ranges, m.index!, m.index! + url.length, "url", url);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}
