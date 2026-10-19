/**
 * Qoidaviy morfologik tahlil: so‘zni o‘zak va qo‘shimchalarga ajratish.
 *
 * Bir so‘z bir nechta tahlilga ega bo‘lishi mumkin (masalan, "otlar": "ot" (hayvon) + -lar
 * yoki "ot" (fe’l) + -lar). Shuning uchun barcha mos variantlar qaytariladi va lug‘atda
 * tasdiqlangan o‘zakka ega variantlar birinchi ko‘rsatiladi. Lug‘atda o‘zak topilmasa,
 * natija "qoidaviy taxmin" deb belgilanadi.
 */
import { normalizeKey } from "../normalize";

export type AffixKind = "so‘z yasovchi" | "lug‘aviy shakl yasovchi" | "sintaktik shakl yasovchi";
type Family = "ot" | "fe’l";

interface Affix {
  form: string;
  kind: AffixKind;
  name: string;
  family: Family;
  /** Qo‘shimchaning tartib o‘rni (o‘zakdan tashqariga qarab o‘sadi) */
  slot: number;
  after?: "vowel" | "consonant";
  /** So‘z yasovchi qo‘shimcha hosil qiladigan turkum */
  makes?: string;
}

const A = (form: string, kind: AffixKind, name: string, family: Family, slot: number, extra: Partial<Affix> = {}): Affix => ({ form, kind, name, family, slot, ...extra });
const Y: AffixKind = "so‘z yasovchi";
const L: AffixKind = "lug‘aviy shakl yasovchi";
const S: AffixKind = "sintaktik shakl yasovchi";

export const AFFIXES: Affix[] = [
  // Ot turkumidagi so‘zlar
  A("chilik", Y, "ot yasovchi (-chilik)", "ot", 1, { makes: "ot" }),
  A("chi", Y, "kasb-hunar egasini bildiruvchi ot yasovchi (-chi)", "ot", 1, { makes: "ot" }),
  A("lik", Y, "mavhum ot yoki sifat yasovchi (-lik)", "ot", 1, { makes: "ot/sifat" }),
  A("dosh", Y, "sherik ma’nosidagi ot yasovchi (-dosh)", "ot", 1, { makes: "ot" }),
  A("xona", Y, "joy oti yasovchi (-xona)", "ot", 1, { makes: "ot" }),
  A("zor", Y, "joy oti yasovchi (-zor)", "ot", 1, { makes: "ot" }),
  A("iston", Y, "joy oti yasovchi (-iston)", "ot", 1, { makes: "ot" }),
  A("shunos", Y, "mutaxassis oti yasovchi (-shunos)", "ot", 1, { makes: "ot" }),
  A("kor", Y, "shaxs oti yasovchi (-kor)", "ot", 1, { makes: "ot" }),
  A("li", Y, "egalik belgisini bildiruvchi sifat yasovchi (-li)", "ot", 1, { makes: "sifat" }),
  A("siz", Y, "yo‘qlik belgisini bildiruvchi sifat yasovchi (-siz)", "ot", 1, { makes: "sifat" }),
  A("simon", Y, "o‘xshashlik sifati yasovchi (-simon)", "ot", 1, { makes: "sifat" }),
  A("viy", Y, "nisbiy sifat yasovchi (-viy)", "ot", 1, { makes: "sifat", after: "vowel" }),
  A("iy", Y, "nisbiy sifat yasovchi (-iy)", "ot", 1, { makes: "sifat", after: "consonant" }),
  A("cha", Y, "kichraytirish yoki ravish yasovchi (-cha)", "ot", 1, { makes: "ot/ravish" }),
  A("la", Y, "fe’l yasovchi (-la)", "ot", 1, { makes: "fe’l" }),
  A("lash", Y, "fe’l yasovchi (-lash)", "ot", 1, { makes: "fe’l" }),
  A("lan", Y, "fe’l yasovchi (-lan)", "ot", 1, { makes: "fe’l" }),
  A("lar", L, "ko‘plik qo‘shimchasi", "ot", 2),
  A("imiz", S, "1-shaxs ko‘plik egalik qo‘shimchasi", "ot", 3, { after: "consonant" }),
  A("miz", S, "1-shaxs ko‘plik egalik qo‘shimchasi", "ot", 3, { after: "vowel" }),
  A("ingiz", S, "2-shaxs ko‘plik egalik qo‘shimchasi", "ot", 3, { after: "consonant" }),
  A("ngiz", S, "2-shaxs ko‘plik egalik qo‘shimchasi", "ot", 3, { after: "vowel" }),
  A("im", S, "1-shaxs birlik egalik qo‘shimchasi", "ot", 3, { after: "consonant" }),
  A("m", S, "1-shaxs birlik egalik qo‘shimchasi", "ot", 3, { after: "vowel" }),
  A("ing", S, "2-shaxs birlik egalik qo‘shimchasi", "ot", 3, { after: "consonant" }),
  A("ng", S, "2-shaxs birlik egalik qo‘shimchasi", "ot", 3, { after: "vowel" }),
  A("si", S, "3-shaxs egalik qo‘shimchasi", "ot", 3, { after: "vowel" }),
  A("i", S, "3-shaxs egalik qo‘shimchasi", "ot", 3, { after: "consonant" }),
  A("ning", S, "qaratqich kelishigi", "ot", 4),
  A("ni", S, "tushum kelishigi", "ot", 4),
  A("ga", S, "jo‘nalish kelishigi", "ot", 4),
  A("ka", S, "jo‘nalish kelishigi (k bilan tugagan so‘zdan keyin)", "ot", 4),
  A("qa", S, "jo‘nalish kelishigi (q bilan tugagan so‘zdan keyin)", "ot", 4),
  A("da", S, "o‘rin-payt kelishigi", "ot", 4),
  A("dan", S, "chiqish kelishigi", "ot", 4),
  A("dagi", L, "o‘rin belgisi (-dagi)", "ot", 5),
  A("gi", L, "payt/o‘rin belgisi (-gi)", "ot", 5),
  A("niki", L, "tegishlilik (-niki)", "ot", 5),
  A("dir", S, "kesimlik qo‘shimchasi (-dir)", "ot", 6),
  A("man", S, "1-shaxs birlik kesimlik qo‘shimchasi", "ot", 6),
  A("san", S, "2-shaxs birlik kesimlik qo‘shimchasi", "ot", 6),
  // Fe’llar
  A("il", L, "majhul nisbat (-il)", "fe’l", 2, { after: "consonant" }),
  A("in", L, "majhul yoki o‘zlik nisbat (-in)", "fe’l", 2, { after: "consonant" }),
  A("n", L, "majhul yoki o‘zlik nisbat (-n)", "fe’l", 2, { after: "vowel" }),
  A("ish", L, "birgalik nisbat yoki harakat nomi (-ish)", "fe’l", 2, { after: "consonant" }),
  A("sh", L, "birgalik nisbat yoki harakat nomi (-sh)", "fe’l", 2, { after: "vowel" }),
  A("dir", L, "orttirma nisbat (-dir)", "fe’l", 2),
  A("tir", L, "orttirma nisbat (-tir)", "fe’l", 2),
  A("t", L, "orttirma nisbat (-t)", "fe’l", 2, { after: "vowel" }),
  A("ma", L, "bo‘lishsizlik qo‘shimchasi", "fe’l", 3),
  A("moqchi", L, "maqsad mayli (-moqchi)", "fe’l", 4),
  A("moqda", L, "hozirgi zamon davom fe’li (-moqda)", "fe’l", 4),
  A("moq", L, "harakat nomi / noaniq shakl (-moq)", "fe’l", 4),
  A("yap", L, "hozirgi zamon davom fe’li (-yap)", "fe’l", 4),
  A("ayap", L, "hozirgi zamon davom fe’li (-ayap)", "fe’l", 4, { after: "consonant" }),
  A("gan", L, "o‘tgan zamon sifatdoshi yoki fe’li (-gan)", "fe’l", 4),
  A("kan", L, "o‘tgan zamon sifatdoshi (-kan)", "fe’l", 4),
  A("qan", L, "o‘tgan zamon sifatdoshi (-qan)", "fe’l", 4),
  A("di", L, "aniq o‘tgan zamon (-di)", "fe’l", 4),
  A("ib", L, "ravishdosh (-ib)", "fe’l", 4, { after: "consonant" }),
  A("b", L, "ravishdosh (-b)", "fe’l", 4, { after: "vowel" }),
  A("gach", L, "ravishdosh (-gach)", "fe’l", 4),
  A("guncha", L, "ravishdosh (-guncha)", "fe’l", 4),
  A("sa", L, "shart mayli (-sa)", "fe’l", 4),
  A("uvchi", L, "sifatdosh / shaxs oti (-uvchi)", "fe’l", 4, { after: "consonant" }),
  A("vchi", L, "sifatdosh / shaxs oti (-vchi)", "fe’l", 4, { after: "vowel" }),
  A("sin", L, "buyruq mayli, 3-shaxs (-sin)", "fe’l", 4),
  A("ar", L, "kelasi zamon sifatdoshi (-ar)", "fe’l", 4, { after: "consonant" }),
  A("r", L, "kelasi zamon sifatdoshi (-r)", "fe’l", 4, { after: "vowel" }),
  A("a", L, "hozirgi-kelasi zamon (-a)", "fe’l", 4, { after: "consonant" }),
  A("y", L, "hozirgi-kelasi zamon (-y)", "fe’l", 4, { after: "vowel" }),
  A("man", S, "1-shaxs birlik", "fe’l", 5),
  A("san", S, "2-shaxs birlik", "fe’l", 5),
  A("miz", S, "1-shaxs ko‘plik", "fe’l", 5),
  A("siz", S, "2-shaxs ko‘plik / hurmat", "fe’l", 5),
  A("di", S, "3-shaxs", "fe’l", 5),
  A("ti", S, "3-shaxs", "fe’l", 5),
  A("lar", S, "3-shaxs ko‘plik", "fe’l", 6),
  A("m", S, "1-shaxs birlik", "fe’l", 5, { after: "vowel" }),
  A("ng", S, "2-shaxs birlik", "fe’l", 5, { after: "vowel" }),
  A("k", S, "1-shaxs ko‘plik", "fe’l", 5, { after: "vowel" }),
  A("ngiz", S, "2-shaxs ko‘plik", "fe’l", 5, { after: "vowel" }),
];

const VOWEL_END = /(a|e|i|o|u|o')$/;

export interface LexiconEntry {
  lemma: string;
  key: string;
  pos: string;
  meaning: string | null;
  status: string;
  origin: string;
}

export interface MorphAnalysis {
  root: string;
  rootKey: string;
  pos: string | null;
  meaning: string | null;
  affixes: Array<{ form: string; kind: AffixKind; name: string }>;
  basis: "lug‘at" | "qoidaviy taxmin";
  lexiconStatus?: string;
  note?: string;
}

interface Path {
  stem: string;
  affixes: Affix[];
  family: Family | null;
}

const NOMINALIZERS = new Set(["uvchi", "vchi", "gan", "kan", "qan", "ish", "sh", "moq"]);

function candidates(word: string): Path[] {
  const out: Path[] = [{ stem: word, affixes: [], family: null }];
  const walk = (stem: string, affixes: Affix[], family: Family | null, maxSlot: number) => {
    if (affixes.length >= 6) return;
    for (const a of AFFIXES) {
      if (!stem.endsWith(a.form)) continue;
      const verbToNoun = family === "ot" && a.family === "fe’l";
      const nounToVerb = family === "fe’l" && a.family === "ot";
      if (verbToNoun) {
        // Fe’ldan ot/sifat yasovchi shakllar: o‘quvchi-lar, o‘qi-sh-im
        if (!NOMINALIZERS.has(a.form)) continue;
      } else if (nounToVerb) {
        // Otdan fe’l yasovchi: ish-la-di
        if (!(a.slot === 1 && a.makes === "fe’l")) continue;
      } else if (a.slot > maxSlot) continue;
      const rest = stem.slice(0, -a.form.length);
      if (rest.replace(/'/g, "").length < 2 || !/[aeiou]/.test(rest)) continue;
      if (a.after === "vowel" && !VOWEL_END.test(rest)) continue;
      if (a.after === "consonant" && VOWEL_END.test(rest)) continue;
      // 3-shaxs -di/-ti faqat hozirgi-kelasi (-a/-y) yoki davom (-yap) shaklidan keyin: bor-a-di, o‘qi-y-di, kel-yap-ti
      if (a.slot === 5 && a.form === "di" && !/(a|y)$/.test(rest)) continue;
      if (a.slot === 5 && a.form === "ti" && !rest.endsWith("yap")) continue;
      const nextFamily: Family = a.slot === 1 && a.makes === "fe’l" ? "ot" : a.family;
      const p: Path = { stem: rest, affixes: [a, ...affixes], family: nextFamily };
      out.push(p);
      walk(rest, p.affixes, nextFamily, a.slot === 1 ? 1 : a.slot - 1);
    }
  };
  walk(word, [], null, 99);
  return out;
}

/** O‘zakdagi tovush o‘zgarishlari: yuragi → yurak, qishlog‘i → qishloq, o‘rni → o‘rin. */
function rootVariants(stem: string, inner?: Affix): Array<{ key: string; note?: string }> {
  const v: Array<{ key: string; note?: string }> = [{ key: stem }];
  // o‘qi + -vchi → o‘quvchi: fe’l oxiridagi i "u" ga aylanadi
  if (inner?.form === "uvchi") v.push({ key: stem + "i", note: "i → u tovush almashinuvi (o‘qi → o‘quvchi)" });
  if (stem.endsWith("g'")) v.push({ key: stem.slice(0, -2) + "q", note: "q → g‘ tovush almashinuvi" });
  else if (stem.endsWith("g")) v.push({ key: stem.slice(0, -1) + "k", note: "k → g tovush almashinuvi" });
  const m = /^(.*[aeiou]'?)([^aeiou'])([^aeiou'])$/.exec(stem);
  if (m) for (const vw of ["i", "u"]) v.push({ key: m[1] + m[2] + vw + m[3], note: "unli tushishi (o‘rin → o‘rni)" });
  return v;
}

export function analyzeWord(word: string, lexicon: Map<string, LexiconEntry[]>): MorphAnalysis[] {
  const w = normalizeKey(word).replace(/[^a-z'-]/g, "");
  if (!w) return [];
  const results: MorphAnalysis[] = [];
  const seen = new Set<string>();
  for (const p of candidates(w)) {
    // O‘zakka bevosita qo‘shilgan (eng ichki) qo‘shimcha o‘zak turkumini belgilaydi.
    const inner = p.affixes[0];
    const rootIsVerb = inner ? inner.family === "fe’l" && !(inner.slot === 1) : null;
    for (const rv of rootVariants(p.stem, inner)) {
      const entries = lexicon.get(rv.key) ?? [];
      const matching = entries.filter((e) => rootIsVerb === null || (e.pos === "fe’l") === rootIsVerb);
      for (const e of matching) {
        const sig = `${e.key}|${e.pos}|${p.affixes.map((x) => x.form + x.slot).join(",")}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        results.push({
          root: e.lemma,
          rootKey: e.key,
          pos: e.pos,
          meaning: e.meaning,
          affixes: p.affixes.map(({ form, kind, name }) => ({ form, kind, name })),
          basis: "lug‘at",
          lexiconStatus: e.origin === "DEMO" ? "namuna" : e.status === "VERIFIED" ? "tasdiqlangan" : "tekshirilmoqda",
          note: rv.note,
        });
      }
    }
  }
  if (results.length) {
    // Kamroq qo‘shimchali (uzunroq o‘zakli) tahlillar oldin
    return results.sort((a, b) => a.affixes.length - b.affixes.length).slice(0, 8);
  }
  // Lug‘atda o‘zak topilmadi — qoidaviy taxminlar (eng ko‘p 3 ta)
  const guesses = candidates(w)
    .filter((p) => p.affixes.length > 0 && p.affixes.every((a) => a.form.length >= 2 || p.affixes.length > 1))
    .sort((a, b) => b.affixes.reduce((s, x) => s + x.form.length, 0) - a.affixes.reduce((s, x) => s + x.form.length, 0))
    .slice(0, 3)
    .map((p) => ({
      root: p.stem.replace(/o'/g, "o‘").replace(/g'/g, "g‘"),
      rootKey: p.stem,
      pos: null,
      meaning: null,
      affixes: p.affixes.map(({ form, kind, name }) => ({ form, kind, name })),
      basis: "qoidaviy taxmin" as const,
    }));
  return guesses.length
    ? guesses
    : [{ root: w.replace(/o'/g, "o‘").replace(/g'/g, "g‘"), rootKey: w, pos: null, meaning: null, affixes: [], basis: "qoidaviy taxmin" }];
}

/** Lug‘atdan turkum ma’lum bo‘lmasa, oxirgi so‘z yasovchi qo‘shimchadan taxmin qilinadi. */
export function inferPos(a: MorphAnalysis): string | null {
  const lastDeriv = [...a.affixes].reverse().find((x) => x.kind === "so‘z yasovchi");
  const affix = lastDeriv ? AFFIXES.find((x) => x.name === lastDeriv.name) : undefined;
  if (affix?.makes) return affix.makes;
  if (a.affixes.some((x) => AFFIXES.find((y) => y.name === x.name)?.family === "fe’l")) return "fe’l";
  return a.pos;
}

/** Lug‘atdan qidirilishi kerak bo‘lgan barcha ehtimoliy o‘zak kalitlari. */
export function candidateRootKeys(word: string): string[] {
  const w = normalizeKey(word).replace(/[^a-z'-]/g, "");
  const keys = new Set<string>();
  for (const p of candidates(w)) for (const rv of rootVariants(p.stem, p.affixes[0])) keys.add(rv.key);
  return [...keys];
}
