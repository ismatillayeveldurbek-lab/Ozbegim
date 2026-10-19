/**
 * NAMUNA MA’LUMOTLAR. Bu yozuvlar interfeysni sinash uchun; ular "DEMO" belgisi bilan
 * saqlanadi va foydalanuvchilarga "Namuna (tasdiqlanmagan)" deb ko‘rsatiladi.
 * Haqiqiy, tasdiqlangan lug‘at ma’lumotlari admin panelidagi import orqali yuklanadi.
 */
export const DEMO_IDIOMS: Array<{ phrase: string; tags: string[]; senses: Array<{ meaning: string; example?: string; synonyms?: string[] }> }> = [
  { phrase: "ko‘z ochib yumguncha", tags: ["vaqt"], senses: [{ meaning: "Juda tez, bir lahzada.", example: "Ko‘z ochib yumguncha bayram ham o‘tib ketdi.", synonyms: ["bir zumda", "qisqa fursatda"] }] },
  { phrase: "qo‘li ochiq", tags: ["xarakter"], senses: [{ meaning: "Saxiy, bor narsasini boshqalardan ayamaydigan.", example: "Akam juda qo‘li ochiq odam.", synonyms: ["saxovatli"] }] },
  { phrase: "boshi osmonga yetdi", tags: ["his-tuyg‘u"], senses: [{ meaning: "Juda xursand bo‘ldi.", example: "Imtihondan o‘tganini eshitib, boshi osmonga yetdi.", synonyms: ["og‘zi qulog‘ida", "ko‘ngli tog‘dek ko‘tarildi"] }] },
  { phrase: "tarvuzi qo‘ltig‘idan tushdi", tags: ["his-tuyg‘u"], senses: [{ meaning: "Umidi puchga chiqib, hafsalasi pir bo‘ldi.", example: "Musobaqada yutqazgach, tarvuzi qo‘ltig‘idan tushdi." }] },
  { phrase: "og‘zi qulog‘ida", tags: ["his-tuyg‘u"], senses: [{ meaning: "Juda xursand, quvonchi yuzidan bilinib turibdi.", example: "Sovg‘ani olgan bola og‘zi qulog‘ida yurardi.", synonyms: ["boshi osmonga yetdi"] }] },
  { phrase: "yuragi yorilay dedi", tags: ["his-tuyg‘u"], senses: [{ meaning: "Qattiq qo‘rqdi.", example: "Kutilmagan ovozdan yuragi yorilay dedi." }] },
  {
    phrase: "boshini qotirmoq",
    tags: ["fikrlash"],
    senses: [
      { meaning: "(O‘z boshini) biror masala ustida uzoq o‘ylamoq.", example: "Bu masala ustida kun bo‘yi boshimni qotirdim." },
      { meaning: "(Birovning boshini) gap bilan chalg‘itmoq, aldab ovora qilmoq.", example: "Bekorchi gaplar bilan boshimni qotirma." },
    ],
  },
  { phrase: "tili qisiq", tags: ["xarakter"], senses: [{ meaning: "Biror aybi bo‘lgani uchun haqqini talab qila olmaydigan, gapira olmaydigan.", example: "Xato qilgani uchun endi tili qisiq." }] },
  { phrase: "ko‘ngli tog‘dek ko‘tarildi", tags: ["his-tuyg‘u"], senses: [{ meaning: "Juda xursand bo‘ldi, ruhi ko‘tarildi.", synonyms: ["boshi osmonga yetdi"] }] },
  { phrase: "qulog‘iga quymoq", tags: ["nasihat"], senses: [{ meaning: "Biror narsani yaxshilab uqtirmoq, eslab qolishini ta’minlamoq.", example: "Ustoz qoidani shogirdlarining qulog‘iga quydi." }] },
];

export const DEMO_LOANWORDS: Array<{
  word: string;
  meaning: string;
  domain?: string;
  originLanguage?: string;
  spellingVariants?: string[];
  alternatives: Array<{ text: string; usageNote?: string }>;
  examples?: string[];
}> = [
  { word: "prezentatsiya", meaning: "Biror loyiha, mahsulot yoki g‘oyani tinglovchilarga tanishtirish.", domain: "ish yuritish", originLanguage: "lotin (rus tili orqali)", alternatives: [{ text: "taqdimot", usageNote: "Barcha rasmiy va norasmiy vaziyatlarda" }], examples: ["Ertaga yangi loyiha taqdimoti bo‘ladi."] },
  { word: "menejer", meaning: "Tashkilot yoki uning bo‘limi ishini boshqaruvchi xodim.", domain: "iqtisod", originLanguage: "ingliz", spellingVariants: ["menedjer"], alternatives: [{ text: "boshqaruvchi", usageNote: "Umumiy ma’noda" }, { text: "rahbar", usageNote: "Bo‘lim yoki jamoa boshlig‘i haqida gapirilganda" }] },
  { word: "dedlayn", meaning: "Ishni topshirishning oxirgi muddati.", domain: "ish yuritish", originLanguage: "ingliz", spellingVariants: ["deadline"], alternatives: [{ text: "muddat" }, { text: "so‘nggi muddat", usageNote: "Oxirgi kun ekanini ta’kidlash kerak bo‘lganda" }], examples: ["Hisobotning so‘nggi muddati — juma."] },
  { word: "fidbek", meaning: "Bajarilgan ish yoki xizmat haqida bildirilgan fikr.", domain: "muloqot", originLanguage: "ingliz", spellingVariants: ["feedback"], alternatives: [{ text: "fikr-mulohaza" }, { text: "munosabat", usageNote: "Qisqa javob, baho ma’nosida" }] },
  { word: "monitoring", meaning: "Biror jarayonni muntazam kuzatib, baholab borish.", domain: "boshqaruv", originLanguage: "ingliz", alternatives: [{ text: "kuzatuv" }, { text: "nazorat", usageNote: "Tekshirish va baholash ma’nosi kuchli bo‘lganda" }] },
  { word: "imidj", meaning: "Shaxs yoki tashkilot haqida jamoatchilikda shakllangan tasavvur.", domain: "jamiyat", originLanguage: "ingliz", alternatives: [{ text: "qiyofa" }, { text: "obro‘", usageNote: "Ijobiy baho ma’nosida" }] },
  { word: "brifing", meaning: "Rasmiy shaxsning jurnalistlar uchun qisqa axborot uchrashuvi.", domain: "ommaviy axborot", originLanguage: "ingliz", alternatives: [] },
  { word: "kompyuter", meaning: "Ma’lumotlarni qayta ishlaydigan elektron qurilma.", domain: "texnika", originLanguage: "ingliz", spellingVariants: ["kompyutor"], alternatives: [], examples: ["Kompyuter savodxonligi bugun har kimga kerak."] },
  { word: "onlayn", meaning: "Internet orqali, tarmoqqa ulangan holda.", domain: "texnika", originLanguage: "ingliz", spellingVariants: ["online"], alternatives: [{ text: "tarmoqda", usageNote: "Holat haqida" }, { text: "masofaviy", usageNote: "Ta’lim yoki ish shakli haqida" }] },
];

export const DEMO_SPELLING: Array<{ wrong: string; correct: string; note: string }> = [
  { wrong: "malumot", correct: "ma’lumot", note: "Tutuq belgisi tushib qolgan." },
  { wrong: "talim", correct: "ta’lim", note: "Tutuq belgisi tushib qolgan." },
  { wrong: "togri", correct: "to‘g‘ri", note: "o‘ va g‘ harflari belgisiz yozilgan." },
  { wrong: "kop", correct: "ko‘p", note: "o‘ harfi belgisiz yozilgan." },
  { wrong: "raxmat", correct: "rahmat", note: "h o‘rnida x yozilgan." },
  { wrong: "xozir", correct: "hozir", note: "h o‘rnida x yozilgan." },
];

export const DEMO_LEXEMES: Array<{ lemma: string; pos: string; meaning: string; examples?: string[] }> = [
  { lemma: "kitob", pos: "ot", meaning: "Bosma yoki qo‘lyozma sahifalardan iborat asar." },
  { lemma: "maktab", pos: "ot", meaning: "Umumiy ta’lim beradigan o‘quv muassasasi." },
  { lemma: "bola", pos: "ot", meaning: "Yoshi kichik inson; farzand." },
  { lemma: "uy", pos: "ot", meaning: "Yashash uchun qurilgan bino." },
  { lemma: "shahar", pos: "ot", meaning: "Katta aholi punkti." },
  { lemma: "til", pos: "ot", meaning: "Muloqot vositasi; og‘izdagi a’zo." },
  { lemma: "so‘z", pos: "ot", meaning: "Ma’noga ega bo‘lgan til birligi." },
  { lemma: "ish", pos: "ot", meaning: "Mehnat, faoliyat." },
  { lemma: "gul", pos: "ot", meaning: "O‘simlikning chiroyli, rangli qismi; gulli o‘simlik." },
  { lemma: "daraxt", pos: "ot", meaning: "Tanasi yog‘ochlashgan ko‘p yillik o‘simlik." },
  { lemma: "ota", pos: "ot", meaning: "Farzandning erkak ota-onasi." },
  { lemma: "ona", pos: "ot", meaning: "Farzandning ayol ota-onasi." },
  { lemma: "xat", pos: "ot", meaning: "Yozma xabar; yozuv." },
  { lemma: "o‘qi", pos: "fe’l", meaning: "Yozuvni ko‘rib tushunmoq; ta’lim olmoq." },
  { lemma: "yoz", pos: "fe’l", meaning: "Harf, so‘z, matn bitmoq." },
  { lemma: "yoz", pos: "ot", meaning: "Yilning eng issiq fasli." },
  { lemma: "kel", pos: "fe’l", meaning: "Biror joyga yetib kelmoq." },
  { lemma: "ber", pos: "fe’l", meaning: "Biror narsani boshqaga topshirmoq." },
  { lemma: "ol", pos: "fe’l", meaning: "Qo‘lga kiritmoq, qabul qilmoq." },
  { lemma: "ko‘r", pos: "fe’l", meaning: "Ko‘z bilan idrok etmoq." },
  { lemma: "bil", pos: "fe’l", meaning: "Xabardor bo‘lmoq, tushunmoq." },
  { lemma: "ishla", pos: "fe’l", meaning: "Mehnat qilmoq." },
  { lemma: "bor", pos: "fe’l", meaning: "Biror joyga yo‘l olmoq." },
  { lemma: "bor", pos: "modal", meaning: "Mavjudlikni bildiradi." },
  { lemma: "ot", pos: "ot", meaning: "Uy hayvoni; narsa-hodisa nomini bildiruvchi so‘z turkumi." },
  { lemma: "ot", pos: "fe’l", meaning: "Biror narsani uloqtirmoq; o‘q uzmoq." },
  { lemma: "yaxshi", pos: "sifat", meaning: "Ijobiy sifatga ega." },
  { lemma: "katta", pos: "sifat", meaning: "Hajmi yoki yoshi ko‘p." },
  { lemma: "go‘zal", pos: "sifat", meaning: "Chiroyli." },
  { lemma: "men", pos: "olmosh", meaning: "1-shaxs birlik kishilik olmoshi." },
  { lemma: "sen", pos: "olmosh", meaning: "2-shaxs birlik kishilik olmoshi." },
  { lemma: "u", pos: "olmosh", meaning: "3-shaxs birlik kishilik olmoshi; ko‘rsatish olmoshi." },
  { lemma: "biz", pos: "olmosh", meaning: "1-shaxs ko‘plik kishilik olmoshi." },
  { lemma: "siz", pos: "olmosh", meaning: "2-shaxs ko‘plik yoki hurmat shakli." },
  { lemma: "ular", pos: "olmosh", meaning: "3-shaxs ko‘plik kishilik olmoshi." },
  { lemma: "bugun", pos: "ravish", meaning: "Shu kunda." },
  { lemma: "ertaga", pos: "ravish", meaning: "Keyingi kunda." },
  { lemma: "tez", pos: "ravish", meaning: "Shoshilib, qisqa vaqtda." },
];
