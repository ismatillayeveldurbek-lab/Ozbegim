import { describe, expect, it } from "vitest";
import { cyrillicToLatin, latinToCyrillic, transliterate } from "@/lib/uz/translit";
import { findProtectedRanges } from "@/lib/uz/protect";
import { detectScript } from "@/lib/uz/script";
import { normalizeKey } from "@/lib/uz/normalize";

describe("lotin → kirill", () => {
  it("asosiy qabul mezonlari", () => {
    expect(latinToCyrillic("O‘zbekiston")).toBe("Ўзбекистон");
    expect(latinToCyrillic("Shahar")).toBe("Шаҳар");
  });

  it("apostrof variantlari bir xil natija beradi", () => {
    for (const v of ["O‘zbekiston", "O'zbekiston", "Oʻzbekiston", "O’zbekiston", "O`zbekiston"]) {
      expect(latinToCyrillic(v)).toBe("Ўзбекистон");
    }
    expect(latinToCyrillic("g‘alaba, bog'")).toBe("ғалаба, боғ");
  });

  it("katta-kichik harflar", () => {
    expect(latinToCyrillic("SHAHAR")).toBe("ШАҲАР");
    expect(latinToCyrillic("O'ZBEKISTON")).toBe("ЎЗБЕКИСТОН");
    expect(latinToCyrillic("Choy va CHOY")).toBe("Чой ва ЧОЙ");
    expect(latinToCyrillic("Yozuv")).toBe("Ёзув");
  });

  it("sh, ch, ng, y+unli, e qoidasi va tutuq", () => {
    expect(latinToCyrillic("choynak")).toBe("чойнак");
    expect(latinToCyrillic("tong")).toBe("тонг");
    expect(latinToCyrillic("yoz yuz yaxshi yer")).toBe("ёз юз яхши ер");
    expect(latinToCyrillic("yo‘l")).toBe("йўл");
    expect(latinToCyrillic("ekin poeziya kecha")).toBe("экин поэзия кеча");
    expect(latinToCyrillic("ma’no san'at")).toBe("маъно санъат");
    expect(latinToCyrillic("Is'hoq")).toBe("Исҳоқ");
    expect(latinToCyrillic("mo‘’jiza")).toBe("мўъжиза");
  });

  it("istisnolar faqat qo‘shimcha zanjiri bilan qo‘llanadi va belgilanadi", () => {
    const r = transliterate("sirkda sirka", { direction: "lat2cyr" });
    expect(r.text).toBe("цирк" + "да сирка");
    expect(r.flags.some((f) => f.reason === "exception" && f.word === "sirkda")).toBe(true);
  });

  it("ismlar va qisqartmalar tekshirish uchun belgilanadi", () => {
    const r = transliterate("Biz Toshkentda BMT bilan ishladik.", { direction: "lat2cyr" });
    expect(r.flags.map((f) => [f.word, f.reason])).toEqual([
      ["Toshkentda", "name"],
      ["BMT", "abbreviation"],
    ]);
  });
});

describe("kirill → lotin", () => {
  it("asosiy holatlar", () => {
    expect(cyrillicToLatin("Ўзбекистон")).toBe("O‘zbekiston");
    expect(cyrillicToLatin("Шаҳар")).toBe("Shahar");
    expect(cyrillicToLatin("ШАҲАР")).toBe("SHAHAR");
    expect(cyrillicToLatin("ЎЗБЕКИСТОН")).toBe("O‘ZBEKISTON");
    expect(cyrillicToLatin("маъно ер поэзия")).toBe("ma’no yer poeziya");
    expect(cyrillicToLatin("Исҳоқ")).toBe("Is’hoq");
    expect(cyrillicToLatin("объект компьютер")).toBe("obyekt kompyuter");
    expect(cyrillicToLatin("цирк милиция")).toBe("sirk militsiya");
  });
  it("apostrof uslubi", () => {
    expect(cyrillicToLatin("ўғил маъно", { apostrophe: "unicode" })).toBe("oʻgʻil maʼno");
    expect(cyrillicToLatin("ўғил маъно", { apostrophe: "ascii" })).toBe("o'g'il ma'no");
  });
  it("qaytariladigan oddiy matn", () => {
    const s = "Bugun ob-havo yaxshi, shamol esmayapti. O‘g‘lim maktabga bordi.";
    expect(cyrillicToLatin(latinToCyrillic(s))).toBe(s);
  });
});

describe("himoyalangan parchalar", () => {
  const conv = (s: string) => latinToCyrillic(s);
  it("URL, email va kod o‘zgarmaydi", () => {
    expect(conv("Sayt: https://example.uz/sahifa?q=salom. Yozing: ali.vali+uz@mail.uz")).toBe(
      "Сайт: https://example.uz/sahifa?q=salom. Ёзинг: ali.vali+uz@mail.uz",
    );
    expect(conv("Buyruq: `npm run dev` va\n```\nconst shahar = 1;\n```\ntayyor")).toBe(
      "Буйруқ: `npm run dev` ва\n```\nconst shahar = 1;\n```\nтайёр",
    );
  });
  it("chegaraviy holatlar", () => {
    // Qavs ichidagi URL: yopuvchi qavs URLga kirmaydi; Wikipedia uslubidagi qavsli URL saqlanadi.
    expect(conv("(manba: https://uz.wikipedia.org/wiki/Bosh_sahifa)")).toBe("(манба: https://uz.wikipedia.org/wiki/Bosh_sahifa)");
    expect(conv("https://en.wikipedia.org/wiki/Tashkent_(city) bor")).toBe("https://en.wikipedia.org/wiki/Tashkent_(city) бор");
    // Protokolsiz domen
    expect(conv("kun.uz saytida")).toBe("kun.uz сайтида");
    // Backtick apostrof sifatida — kod emas
    expect(conv("o`zbek va g`alaba")).toBe("ўзбек ва ғалаба");
    // Yopilmagan kod bloki oddiy matn
    expect(conv("```kod")).toBe("```код");
    // Narxlar formula emas, $x^2$ esa formula
    expect(conv("$5 va $10 narx, $x^2 + y$ formula")).toBe("$5 ва $10 нарх, $x^2 + y$ формула");
    // Foydalanuvchi belgilagan parcha (belgilar olib tashlanadi)
    expect(conv("{{Shahar Mall}} yaqinida")).toBe("Shahar Mall яқинида");
    // Gap oxiridagi email
    const r = findProtectedRanges("Pochta: info@ozbegim.uz.");
    expect(r.map((x) => x.output)).toEqual(["info@ozbegim.uz"]);
  });
  it("himoyani o‘chirib qo‘yish mumkin", () => {
    expect(transliterate("www.shahar.uz", { direction: "lat2cyr", protect: { urls: false } }).text).toBe("www.шаҳар.уз");
  });
});

describe("tokenlar manba oralig‘ini saqlaydi", () => {
  it("har bir token manbaga mos", () => {
    const src = "Shahar o‘zbek";
    const r = transliterate(src, { direction: "lat2cyr", withTokens: true });
    expect(r.tokens!.map((t) => src.slice(t.srcStart, t.srcEnd))).toEqual(["Sh", "a", "h", "a", "r", " ", "o‘", "z", "b", "e", "k"]);
  });
});

describe("yozuvni aniqlash", () => {
  it("lotin, kirill, aralash", () => {
    expect(detectScript("Salom dunyo").kind).toBe("latin");
    expect(detectScript("Салом дунё").kind).toBe("cyrillic");
    expect(detectScript("Salom дунё, qalaysan яхшимисан").kind).toBe("mixed");
    // "Sаlom" — ikkinchi harf kirill "а"
    expect(detectScript("Sаlom").mixedWords).toEqual(["Sаlom"]);
  });
});

describe("qidiruv kaliti", () => {
  it("lotin/kirill va apostrof variantlari bitta kalit", () => {
    const k = normalizeKey("O‘zbekiston");
    for (const v of ["o'zbekiston", "OʻZBEKISTON", "Ўзбекистон", " o`zbekiston "]) expect(normalizeKey(v)).toBe(k);
    expect(normalizeKey("Маъно")).toBe(normalizeKey("ma’no"));
    expect(normalizeKey("ер")).toBe(normalizeKey("yer"));
  });
  it("turli so‘zlar birlashmaydi", () => {
    expect(normalizeKey("so‘z")).not.toBe(normalizeKey("soz"));
    expect(normalizeKey("o‘q")).not.toBe(normalizeKey("oq"));
    expect(normalizeKey("ma'no")).not.toBe(normalizeKey("mano"));
    expect(normalizeKey("xol")).not.toBe(normalizeKey("hol"));
    expect(normalizeKey("ўқ")).not.toBe(normalizeKey("ук"));
  });
  it("tinish belgilari va tirelar", () => {
    expect(normalizeKey("  Ko‘z  ochib — yumguncha! ")).toBe("ko'z ochib-yumguncha");
  });
});
