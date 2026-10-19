import { describe, expect, it } from "vitest";
import { analyzeWord, type LexiconEntry } from "@/lib/uz/analysis/morphology";
import { letterReport, syllabify } from "@/lib/uz/analysis/phonetics";
import { normalizeKey } from "@/lib/uz/normalize";

const lex = new Map<string, LexiconEntry[]>();
for (const [lemma, pos] of [["kitob", "ot"], ["maktab", "ot"], ["o‘qi", "fe’l"], ["kel", "fe’l"], ["bor", "fe’l"], ["ot", "ot"], ["ot", "fe’l"], ["ish", "ot"], ["yurak", "ot"], ["qishloq", "ot"], ["o‘rin", "ot"], ["bola", "ot"]] as const) {
  const key = normalizeKey(lemma);
  lex.set(key, [...(lex.get(key) ?? []), { lemma, key, pos, meaning: null, status: "VERIFIED", origin: "OFFICIAL" }]);
}
const show = (w: string) => analyzeWord(w, lex).map((a) => `${a.root}(${a.pos ?? "?"})+${a.affixes.map((x) => x.form).join("+")}`);

describe("bo‘g‘in va harf-tovush", () => {
  it("bo‘g‘inlarga ajratish", () => {
    expect(syllabify("maktab")).toEqual(["mak", "tab"]);
    expect(syllabify("Toshkent")).toEqual(["tosh", "kent"]);
    expect(syllabify("o‘quvchi")).toEqual(["o‘", "quv", "chi"]);
    expect(syllabify("do‘stlik")).toEqual(["do‘st", "lik"]);
    expect(syllabify("singil")).toEqual(["si", "ngil"]);
    expect(syllabify("ona")).toEqual(["o", "na"]);
  });
  it("harflar soni: o‘, sh, ng — bitta harf; tutuq — belgi", () => {
    const r = letterReport("ma’nosi");
    expect(r.letters).toBe(6);
    expect(r.hasTutuq).toBe(true);
    expect(letterReport("shahar").letters).toBe(5);
    expect(letterReport("tong").letters).toBe(3);
  });
});

describe("morfologik tahlil", () => {
  it("ot: ko‘plik, egalik, kelishik", () => {
    expect(show("kitoblarimizdan")).toContain("kitob(ot)+lar+imiz+dan");
    expect(show("maktabga")[0]).toBe("maktab(ot)+ga");
  });
  it("fe’l: zamon va shaxs", () => {
    expect(show("o‘qiydi")).toContain("o‘qi(fe’l)+y+di");
    expect(show("keldi")).toEqual(["kel(fe’l)+di"]);
    expect(show("bormadim")).toContain("bor(fe’l)+ma+di+m");
  });
  it("so‘z yasovchi va turkumdan o‘tish", () => {
    expect(show("o‘quvchilar")).toContain("o‘qi(fe’l)+uvchi+lar");
    expect(show("ishladi")).toContain("ish(ot)+la+di");
  });
  it("tovush almashinuvi", () => {
    expect(show("yuragi")).toContain("yurak(ot)+i");
    expect(show("qishlog‘imiz")).toContain("qishloq(ot)+imiz");
  });
  it("bir nechta tahlil (omonimlar)", () => {
    const r = show("otlar");
    expect(r).toContain("ot(ot)+lar");
    expect(r).toContain("ot(fe’l)+lar");
  });
  it("lug‘atda yo‘q o‘zak — qoidaviy taxmin", () => {
    const r = analyzeWord("daftarlarda", lex);
    expect(r[0].basis).toBe("qoidaviy taxmin");
    expect(r[0].root).toBe("daftar");
  });
});

import { analyzeSentence } from "@/lib/uz/analysis/sentence";

for (const [lemma, pos] of [["men", "olmosh"], ["katta", "sifat"], ["bugun", "ravish"], ["do‘st", "ot"], ["xat", "ot"], ["yoz", "fe’l"], ["uka", "ot"], ["o‘qituvchi", "ot"]] as const) {
  const key = normalizeKey(lemma);
  lex.set(key, [...(lex.get(key) ?? []), { lemma, key, pos, meaning: null, status: "VERIFIED", origin: "OFFICIAL" }]);
}
const roles = (s: string) => analyzeSentence(s, lex).roles.map((r) => `${r.word}:${r.role}`);

describe("gap tahlili", () => {
  it("ega, kesim, to‘ldiruvchi, hol, aniqlovchi", () => {
    expect(roles("Men bugun do‘stimga xat yozdim")).toEqual(["Men:ega", "bugun:hol", "do‘stimga:to‘ldiruvchi", "xat:to‘ldiruvchi", "yozdim:kesim"]);
    expect(roles("Ukamning kitobi katta")).toEqual(["Ukamning:aniqlovchi", "kitobi:ega", "katta:kesim"]);
    expect(roles("Bola katta maktabga bordi")).toEqual(["Bola:ega", "katta:aniqlovchi", "maktabga:hol", "bordi:kesim"]);
  });
  it("noaniq holat muqobil talqin bilan beriladi", () => {
    const r = analyzeSentence("Bola maktabga bordi", lex).roles[1];
    expect(r.basis).toBe("taxmin");
    expect(r.alternative).toContain("to‘ldiruvchi");
  });
  it("yashirin ega haqida ogohlantirish", () => {
    expect(analyzeSentence("Kitobni o‘qidim", lex).warnings.join(" ")).toContain("yashirin ega");
  });
});

import { textStats } from "@/lib/uz/stats";

describe("matn statistikasi", () => {
  it("belgi, so‘z, gap, paragraf va yozuv tarkibi", () => {
    const s = textStats("Ota-ona keldi. O‘zbek tili go‘zal!\n\nЎзбек тили. Sаlom 2024");
    expect(s.charsWithSpaces).toBe(58);
    expect(s.words).toBe(9);
    expect(s.sentences).toBe(4);
    expect(s.paragraphs).toBe(2);
    expect(s.script).toMatchObject({ latinWords: 5, cyrillicWords: 2, mixedWords: 1, otherWords: 1 });
    expect(s.topWords.slice(0, 2)).toEqual([
      { word: "o‘zbek", count: 2 },
      { word: "tili", count: 2 },
    ]);
  });
});
