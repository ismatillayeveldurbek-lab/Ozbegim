import { describe, expect, it } from "vitest";
import { applyAll, applySuggestion, checkSpelling } from "@/lib/uz/spelling/check";

const types = (t: string, o = {}) => checkSpelling(t, o).map((s) => [s.original, s.replacement, s.type]);

describe("imlo tekshiruvi", () => {
  it("o‘/g‘ va tutuq xatolari, katta harf", () => {
    expect(types("bugun kop malumot keldi.")).toEqual([
      ["b", "B", "katta_harf"],
      ["kop", "ko‘p", "o_g_belgisi"],
      ["malumot", "ma’lumot", "tutuq"],
    ]);
  });
  it("apostrof uslubi va noto‘g‘ri belgilar", () => {
    const r = checkSpelling("O‘zbek tili. O`g`il bola.");
    expect(r.map((s) => [s.original, s.replacement, s.confidence])).toEqual([
      ["`", "‘", "aniq"],
      ["`", "‘", "aniq"],
    ]);
  });
  it("atoqli otlar, ism-familiyaga tegmaslik", () => {
    expect(types("Biz toshkentda yashaymiz.")).toEqual([["t", "T", "katta_harf"]]);
    // Gap o‘rtasidagi bosh harfli noma’lum so‘z (ism) xato deb belgilanmaydi
    expect(types("Bu kitobni Malumot Aliyev yozgan.")).toEqual([]);
  });
  it("qo‘shib, ajratib va chiziqcha bilan yozish", () => {
    expect(types("Kutub xonada harbir ota ona bor.")).toEqual([
      ["Kutub xonada", "Kutubxonada", "qoshib_yozish"],
      ["harbir", "har bir", "ajratib_yozish"],
      ["ota ona", "ota-ona", "chiziqcha"],
    ]);
    expect(types("Sen chi? Katta katta uylar va va bog‘lar.")).toEqual([
      [" ", "-", "chiziqcha"],
      ["Katta katta", "Katta-katta", "chiziqcha"],
      ["va va", "va", "imlo"],
    ]);
  });
  it("bo‘shliqlar", () => {
    expect(types("Salom ,dunyo.  Yaxshi ( bugun )")).toEqual([
      [" ", "", "bo_shliq"],
      ["", " ", "bo_shliq"],
      ["  ", " ", "bo_shliq"],
      [" ", "", "bo_shliq"],
      [" ", "", "bo_shliq"],
    ]);
  });
  it("tinish belgilari faqat yoqilganda", () => {
    const t = "Men keldim lekin u ketdi,, keyin";
    expect(types(t).filter((x) => x[2] === "tinish")).toEqual([]);
    expect(types(t, { punctuation: true }).filter((x) => x[2] === "tinish")).toEqual([
      [" ", ", ", "tinish"],
      [",,", ",", "tinish"],
      ["", ".", "tinish"],
    ]);
  });
  it("shaxsiy lug‘at va himoyalangan parchalar e’tiborsiz qoldiriladi", () => {
    expect(types("Bizda kop narsa bor.", { ignore: new Set(["kop"]) })).toEqual([]);
    expect(types("Manzil: https://kop.uz/malumot va `kop`")).toEqual([]);
  });
  it("kirill matn: bazadagi juftlik va aralash yozuv", () => {
    const r = checkSpelling("Бугун кўп малумот. Sаlom", { pairs: [{ wrongKey: "malumot", correct: "ma’lumot", note: "Tutuq" }] });
    expect(r.map((s) => [s.original, s.replacement, s.source])).toEqual([
      ["малумот", "маълумот", "lug‘at"],
      ["Sаlom", "Salom", "qoida"],
    ]);
  });
  it("kontekstga bog‘liq so‘zlar xato deb belgilanmaydi", () => {
    expect(types("Bu soz chalindi. Oq qor yog‘di.")).toEqual([]);
  });
});

describe("tavsiyalarni xavfsiz qo‘llash", () => {
  it("bittasini qabul qilgandan keyin qolganlari to‘g‘ri joyga tushadi (qayta hisoblash)", () => {
    let text = "kop malumot va togri javob";
    const first = checkSpelling(text);
    expect(first.map((s) => [s.original, s.replacement])).toEqual([["kop", "Ko‘p"], ["malumot", "ma’lumot"], ["togri", "to‘g‘ri"]]);
    // "malumot" ni qabul qilamiz — matn uzunligi o‘zgaradi
    text = applySuggestion(text, first[1])!;
    expect(text).toBe("kop ma’lumot va togri javob");
    // Eski indeks bilan "togri" ni qo‘llashga urinish rad etiladi
    expect(applySuggestion(text, first[2])).toBeNull();
    const again = checkSpelling(text);
    const t = again.find((s) => s.original === "togri")!;
    expect(applySuggestion(text, t)).toBe("kop ma’lumot va to‘g‘ri javob");
    expect(again[0].replacement).toBe("Ko‘p");
  });
  it("barchasini qabul qilish va ortga qaytarish", () => {
    const original = "bugun kop malumot keldi";
    const r = applyAll(original, checkSpelling(original));
    expect(r.text).toBe("Bugun ko‘p ma’lumot keldi");
    expect(r.applied).toBe(3);
    // Ortga qaytarish — interfeysda oldingi matn holati stekdan tiklanadi
    const undo = [original];
    expect(undo.pop()).toBe(original);
  });
});
