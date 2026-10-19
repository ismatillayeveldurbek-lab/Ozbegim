/**
 * Lotin → kirill o‘girishda qoidadan tashqari yoziladigan o‘zlashma so‘zlar.
 * Lotin yozuvida "ц", "ь", "ъ" kabi harflar ko‘rinmaydi, shuning uchun bu so‘zlarni
 * qoidalar bilan to‘g‘ri tiklab bo‘lmaydi. Ro‘yxat ataylab qisqa va ehtiyotkor:
 * bu yerdagi har bir o‘girish natijada "Tekshirish tavsiya etiladi" belgisini oladi.
 *
 * Kalit — lotin yozuvidagi o‘zak (kichik harflarda), qiymat — kirill yozuvi.
 */
export const LAT2CYR_EXCEPTIONS: Record<string, string> = {
  sirk: "цирк",
  sentr: "центр",
  sement: "цемент",
  konsert: "концерт",
  aksiya: "акция",
  stansiya: "станция",
  militsiya: "милиция",
  politsiya: "полиция",
  funksiya: "функция",
  revolyutsiya: "революция",
  kompyuter: "компьютер",
  rayon: "район",
  oktyabr: "октябрь",
  sentyabr: "сентябрь",
  noyabr: "ноябрь",
  dekabr: "декабрь",
  yanvar: "январь",
  fevral: "февраль",
  aprel: "апрель",
  iyun: "июнь",
  iyul: "июль",
  sotsial: "социал",
  medal: "медаль",
  film: "фильм",
  pyesa: "пьеса",
  obyekt: "объект",
  subyekt: "субъект",
};

/**
 * O‘zakdan keyin kelishi mumkin bo‘lgan qo‘shimchalar. Istisno faqat so‘zning qolgan qismi
 * shu qo‘shimchalar zanjiridan iborat bo‘lsa qo‘llanadi ("sirka" ≠ "sirk" + "a").
 */
const SUFFIXES = [
  "larning", "lardan", "larda", "larga", "larni", "lari", "lar",
  "ning", "dagi", "dan", "da", "ga", "ka", "ni", "niki",
  "imiz", "ingiz", "ing", "im", "si", "i",
  "chi", "lik", "li", "siz", "cha", "day", "dek", "ga", "gi", "dir",
];

export function isSuffixChain(rest: string): boolean {
  if (rest === "") return true;
  for (const s of SUFFIXES) {
    if (rest.startsWith(s) && isSuffixChain(rest.slice(s.length))) return true;
  }
  return false;
}

const SORTED_STEMS = Object.keys(LAT2CYR_EXCEPTIONS).sort((a, b) => b.length - a.length);

/** So‘z boshidagi istisno o‘zagini topadi. `lower` — kichik harfli, apostrofsiz so‘z. */
export function findLatinException(lower: string): { stem: string; cyrillic: string } | null {
  for (const stem of SORTED_STEMS) {
    if (lower.startsWith(stem) && isSuffixChain(lower.slice(stem.length))) {
      return { stem, cyrillic: LAT2CYR_EXCEPTIONS[stem] };
    }
  }
  return null;
}
