import { describe, expect, it } from "vitest";
import { parseAiJson } from "@/lib/ai-json";
import { normalizeTranslation, NOT_UNDERSTOOD } from "@/lib/server/tourist-translator";
import { normalizeWordAnalysis, validateWord } from "@/lib/server/word-analyzer";

describe("AI JSON’ni xavfsiz parse qilish", () => {
  it("toza JSON, ```json bloki, atrofida matn, satr ichidagi qavslar", () => {
    expect(parseAiJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseAiJson('```json\n{"a": "b"}\n```')).toEqual({ a: "b" });
    expect(parseAiJson('```\n{"a": 2}\n```')).toEqual({ a: 2 });
    expect(parseAiJson('Mana natija: {"misol": "U {qavs} dedi", "n": 1} tamom')).toEqual({ misol: "U {qavs} dedi", n: 1 });
  });
  it("buzilgan javob — istisno emas, null", () => {
    expect(parseAiJson("```json\n{\"a\": \n```")).toBeNull();
    expect(parseAiJson("hech qanday json yo‘q")).toBeNull();
    expect(parseAiJson("")).toBeNull();
  });
});

describe("So‘z tahlilchisi", () => {
  it("kiritishni tekshirish", () => {
    expect(() => validateWord("   ")).toThrow("Iltimos, so‘z kiriting.");
    expect(() => validateWord("salom123")).toThrow(/harflardan/);
    expect(() => validateWord("bir ikki uch tort")).toThrow(/qisqa birikma/);
    expect(validateWord("  ko‘z  ")).toBe("ko‘z");
    expect(validateWord("китоб")).toBe("китоб");
  });
  it("javobni normallashtirish: sinonim ≤ 6, misol massiv yoki satr, turkum", () => {
    const r = normalizeWordAnalysis({ manosi: "Yozuvli asar", sinonimlar: ["a", "b", "b", " ", "c", "d", "e", "f", "g"], antonimlar: [], misol: ["1-gap", "2-gap", "3-gap"], turkum: "ot" });
    expect(r).toEqual({ found: true, manosi: "Yozuvli asar", sinonimlar: ["a", "b", "c", "d", "e", "f"], antonimlar: [], misollar: ["1-gap", "2-gap"], turkum: "ot" });
    expect(normalizeWordAnalysis({ manosi: "m", sinonimlar: "x, y", misol: "Bitta gap." })).toMatchObject({ sinonimlar: ["x", "y"], misollar: ["Bitta gap."], turkum: "aniqlanmadi" });
  });
  it("topilmagan so‘z va noto‘g‘ri tuzilma", () => {
    expect(normalizeWordAnalysis({ xato: "So'z topilmadi" })).toMatchObject({ found: false });
    expect(() => normalizeWordAnalysis({ foo: 1 })).toThrow(/kutilgan/);
  });
});

describe("Turistlar tarjimoni", () => {
  it("javobni normallashtirish va 8-qoida", () => {
    expect(normalizeTranslation({ source_language: "Ingliz tili", translation: " Registonga qanday borsam bo‘ladi? " })).toEqual({
      source_language: "Ingliz tili",
      translation: "Registonga qanday borsam bo‘ladi?",
      understood: true,
    });
    expect(normalizeTranslation({ source_language: "", translation: NOT_UNDERSTOOD })).toMatchObject({ understood: false, translation: NOT_UNDERSTOOD });
    expect(() => normalizeTranslation({ text: "x" })).toThrow(/kutilgan/);
  });
});

describe("javoblardagi apostroflarni tipografik qilish", () => {
  it("o'/g' → o‘/g‘, tutuq → ’, qo‘shtirnoqqa tegmaydi", async () => {
    const { toTypographic } = await import("@/lib/uz/alphabet");
    expect(toTypographic("o'qish, to'g'ri, tog' va bog'")).toBe("o‘qish, to‘g‘ri, tog‘ va bog‘");
    expect(toTypographic("ta'lim va ma'lumot")).toBe("ta’lim va ma’lumot");
    expect(toTypographic("U 'salom' dedi")).toBe("U 'salom' dedi");
  });
});
