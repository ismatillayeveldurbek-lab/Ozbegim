/**
 * Harf va tovush tahlili, bo‘g‘inlarga ajratish (lotin yozuvi).
 */
import { normalizeKey } from "../normalize";

export type PhonemeKind = "unli" | "undosh" | "belgi";

export interface Phoneme {
  letter: string;
  kind: PhonemeKind;
  /** Undoshlar uchun: jarangli / jarangsiz; unlilar uchun: lablangan / lablanmagan */
  feature?: string;
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "o'"]);
const VOICED = new Set(["b", "v", "g", "d", "j", "z", "l", "m", "n", "r", "y", "g'", "ng"]);
const SONOR = new Set(["l", "m", "n", "r", "y", "ng"]);
const LABIAL_VOWELS = new Set(["o", "u", "o'"]);

/** So‘zni o‘zbek alifbosi harflariga ajratadi: o‘, g‘, sh, ch, ng bitta harf; tutuq — belgi. */
export function splitLetters(word: string): Phoneme[] {
  const w = normalizeKey(word).replace(/[^a-z']/g, "");
  const out: Phoneme[] = [];
  for (let i = 0; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    let letter: string;
    if (two === "o'" || two === "g'") letter = two;
    else if ((two === "sh" || two === "ch") && !(two === "sh" && w[i + 2] === "'")) letter = two;
    else if (two === "ng") letter = "ng";
    else letter = w[i];
    i += letter.length - 1;
    if (letter === "'") {
      out.push({ letter: "’", kind: "belgi", feature: "tutuq belgisi" });
      continue;
    }
    if (VOWELS.has(letter)) out.push({ letter, kind: "unli", feature: LABIAL_VOWELS.has(letter) ? "lablangan" : "lablanmagan" });
    else out.push({ letter, kind: "undosh", feature: SONOR.has(letter) ? "jarangli (sonor)" : VOICED.has(letter) ? "jarangli" : "jarangsiz" });
  }
  return out;
}

/**
 * Bo‘g‘inlarga ajratish: har bir unli — bitta bo‘g‘in. Unlilar orasidagi bitta undosh keyingi
 * bo‘g‘inga o‘tadi (o-na), bir nechta undoshdan faqat oxirgisi o‘tadi (mak-tab, do‘st-lik).
 * "ng" bitta tovushni bildirgani uchun ajratilmaydi (si-ngil).
 */
export function syllabify(word: string): string[] {
  const ph = splitLetters(word);
  const vowelIdx = ph.map((p, i) => (p.kind === "unli" ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length <= 1) return [ph.map((p) => p.letter).join("")];
  const cuts: number[] = [];
  for (let k = 0; k + 1 < vowelIdx.length; k++) {
    const a = vowelIdx[k];
    const b = vowelIdx[k + 1];
    const between = [];
    for (let i = a + 1; i < b; i++) if (ph[i].kind === "undosh") between.push(i);
    if (!between.length) cuts.push(b);
    else cuts.push(between[between.length - 1]);
  }
  const syll: string[] = [];
  let start = 0;
  for (const c of cuts) {
    syll.push(ph.slice(start, c).map((p) => p.letter).join(""));
    start = c;
  }
  syll.push(ph.slice(start).map((p) => p.letter).join(""));
  return syll.map((s) => s.replace(/o'/g, "o‘").replace(/g'/g, "g‘"));
}

export function letterReport(word: string) {
  const ph = splitLetters(word);
  const letters = ph.filter((p) => p.kind !== "belgi").length;
  const vowels = ph.filter((p) => p.kind === "unli").length;
  return {
    phonemes: ph.map((p) => ({ ...p, letter: p.letter.replace("o'", "o‘").replace("g'", "g‘") })),
    letters,
    sounds: letters,
    vowels,
    consonants: letters - vowels,
    hasTutuq: ph.some((p) => p.kind === "belgi"),
    note: ph.some((p) => p.kind === "belgi")
      ? "Tutuq belgisi harf emas; u oldingi unlining cho‘ziq yoki uzilib talaffuz qilinishini bildiradi."
      : "O‘zbek lotin yozuvida o‘, g‘, sh, ch, ng — har biri bitta harf va bitta tovush hisoblanadi.",
  };
}
