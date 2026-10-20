/**
 * Imlo tekshiruvi uchun ichki ro‘yxatlar. Faqat bir ma’noli holatlar kiritilgan:
 * masalan, "soz" (cholg‘u) va "so‘z" ikkalasi ham to‘g‘ri so‘z — shuning uchun ro‘yxatda yo‘q.
 * Kalitlar normalizeKey() ko‘rinishida (lotin, kichik harf, apostrof ').
 */

export interface KnownError {
  correct: string;
  type: SuggestionType;
  note: string;
  /** aniq — bir ma’noli; ehtimoliy — kontekstga bog‘liq */
  confidence: "aniq" | "ehtimoliy";
}

export type SuggestionType =
  | "imlo"
  | "o_g_belgisi"
  | "tutuq"
  | "katta_harf"
  | "qoshib_yozish"
  | "ajratib_yozish"
  | "chiziqcha"
  | "bo_shliq"
  | "tinish"
  | "aralash_yozuv";

export const TYPE_LABEL: Record<SuggestionType, string> = {
  imlo: "Imlo xatosi",
  o_g_belgisi: "O‘ / G‘ yozilishi",
  tutuq: "Tutuq belgisi",
  katta_harf: "Katta-kichik harf",
  qoshib_yozish: "Qo‘shib yozish",
  ajratib_yozish: "Ajratib yozish",
  chiziqcha: "Chiziqcha bilan yozish",
  bo_shliq: "Bo‘shliq",
  tinish: "Tinish belgisi",
  aralash_yozuv: "Aralash yozuv",
};

const ogMissing = (correct: string): KnownError => ({ correct, type: "o_g_belgisi", note: "o‘ yoki g‘ harfi belgisiz yozilgan.", confidence: "aniq" });
const tutuqMissing = (correct: string): KnownError => ({ correct, type: "tutuq", note: "Tutuq belgisi (’) tushib qolgan.", confidence: "aniq" });

/** Bir ma’noli xato yozilishlar (xato kaliti → to‘g‘ri shakl). */
export const KNOWN_ERRORS: Record<string, KnownError> = {
  ozbek: ogMissing("o‘zbek"),
  ozbekcha: ogMissing("o‘zbekcha"),
  ozbekiston: { correct: "O‘zbekiston", type: "o_g_belgisi", note: "o‘ harfi belgisiz va kichik harf bilan yozilgan.", confidence: "aniq" },
  togri: ogMissing("to‘g‘ri"),
  "to'gri": ogMissing("to‘g‘ri"),
  "tog'ri": ogMissing("to‘g‘ri"),
  kop: ogMissing("ko‘p"),
  boladi: ogMissing("bo‘ladi"),
  bolib: ogMissing("bo‘lib"),
  bolgan: ogMissing("bo‘lgan"),
  bolsa: ogMissing("bo‘lsa"),
  boyicha: ogMissing("bo‘yicha"),
  ogil: ogMissing("o‘g‘il"),
  "o'gil": ogMissing("o‘g‘il"),
  oquvchi: ogMissing("o‘quvchi"),
  oqituvchi: ogMissing("o‘qituvchi"),
  ozgarish: ogMissing("o‘zgarish"),
  goya: ogMissing("g‘oya"),
  mano: tutuqMissing("ma’no"),
  manosi: tutuqMissing("ma’nosi"),
  malumot: tutuqMissing("ma’lumot"),
  talim: tutuqMissing("ta’lim"),
  tasir: tutuqMissing("ta’sir"),
  sanat: tutuqMissing("san’at"),
  etibor: tutuqMissing("e’tibor"),
  etirof: tutuqMissing("e’tirof"),
  elon: tutuqMissing("e’lon"),
  menang: { correct: "mening", type: "imlo", note: "Qaratqich kelishigi qo‘shimchasi “-ning”: men + ning = mening.", confidence: "aniq" },
  menig: { correct: "mening", type: "imlo", note: "Qaratqich kelishigi qo‘shimchasi “-ning”: men + ning = mening.", confidence: "aniq" },
  menning: { correct: "mening", type: "imlo", note: "“men” olmoshiga “-ning” qo‘shilganda bitta “n” tushib qoladi: mening.", confidence: "aniq" },
  senang: { correct: "sening", type: "imlo", note: "Qaratqich kelishigi qo‘shimchasi “-ning”: sen + ning = sening.", confidence: "aniq" },
  senig: { correct: "sening", type: "imlo", note: "Qaratqich kelishigi qo‘shimchasi “-ning”: sen + ning = sening.", confidence: "aniq" },
  senning: { correct: "sening", type: "imlo", note: "“sen” olmoshiga “-ning” qo‘shilganda bitta “n” tushib qoladi: sening.", confidence: "aniq" },
  unig: { correct: "uning", type: "imlo", note: "Qaratqich kelishigi qo‘shimchasi “-ning”: uning.", confidence: "aniq" },
  raxmat: { correct: "rahmat", type: "imlo", note: "“h” o‘rnida “x” yozilgan.", confidence: "aniq" },
  xozir: { correct: "hozir", type: "imlo", note: "“h” o‘rnida “x” yozilgan.", confidence: "aniq" },
  xamma: { correct: "hamma", type: "imlo", note: "“h” o‘rnida “x” yozilgan.", confidence: "aniq" },
  xech: { correct: "hech", type: "imlo", note: "“h” o‘rnida “x” yozilgan.", confidence: "aniq" },
  xar: { correct: "har", type: "imlo", note: "“h” o‘rnida “x” yozilgan.", confidence: "ehtimoliy" },
  harbir: { correct: "har bir", type: "ajratib_yozish", note: "“har” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  harkim: { correct: "har kim", type: "ajratib_yozish", note: "“har” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  harxil: { correct: "har xil", type: "ajratib_yozish", note: "“har” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  harqanday: { correct: "har qanday", type: "ajratib_yozish", note: "“har” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  hechkim: { correct: "hech kim", type: "ajratib_yozish", note: "“hech” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  hechnarsa: { correct: "hech narsa", type: "ajratib_yozish", note: "“hech” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  hechqachon: { correct: "hech qachon", type: "ajratib_yozish", note: "“hech” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  hechqayer: { correct: "hech qayer", type: "ajratib_yozish", note: "“hech” so‘zi keyingi so‘zdan ajratib yoziladi.", confidence: "aniq" },
  birnecha: { correct: "bir necha", type: "ajratib_yozish", note: "“bir necha” ajratib yoziladi.", confidence: "aniq" },
  birqancha: { correct: "bir qancha", type: "ajratib_yozish", note: "“bir qancha” ajratib yoziladi.", confidence: "aniq" },
  nimauchun: { correct: "nima uchun", type: "ajratib_yozish", note: "Ko‘makchi “uchun” ajratib yoziladi.", confidence: "aniq" },
  shuninguchun: { correct: "shuning uchun", type: "ajratib_yozish", note: "Ko‘makchi “uchun” ajratib yoziladi.", confidence: "aniq" },
};

/** Qo‘shib yoziladigan qo‘shma so‘zlar ("osh xona" → "oshxona"). Kalit: ikki so‘z, normallashtirilgan. */
export const JOINED_COMPOUNDS: Record<string, string> = {
  "osh xona": "oshxona",
  "ish xona": "ishxona",
  "kutub xona": "kutubxona",
  "dori xona": "dorixona",
  "mehmon xona": "mehmonxona",
  "choy xona": "choyxona",
  "taklif noma": "taklifnoma",
  "tabrik noma": "tabriknoma",
  "guvoh noma": "guvohnoma",
  "til shunos": "tilshunos",
  "tarix shunos": "tarixshunos",
  "adabiyot shunos": "adabiyotshunos",
  "sinf dosh": "sinfdosh",
  "vatan dosh": "vatandosh",
};

/** Juft so‘zlar — chiziqcha bilan yoziladi. Ikkinchi so‘z qo‘shimcha olishi mumkin. */
export const PAIR_WORDS: Array<[string, string]> = [
  ["ota", "ona"],
  ["aka", "uka"],
  ["opa", "singil"],
  ["o'g'il", "qiz"],
  ["yaxshi", "yomon"],
  ["katta", "kichik"],
  ["kecha", "kunduz"],
  ["asta", "sekin"],
  ["baxt", "saodat"],
  ["bola", "chaqa"],
  ["uy", "joy"],
  ["kiyim", "kechak"],
  ["idish", "tovoq"],
  ["mol", "mulk"],
  ["qo'ni", "qo'shni"],
  ["el", "yurt"],
  ["yosh", "qari"],
  ["ertami", "kechmi"],
];

/** Gap ichida ham katta harf bilan yoziladigan atoqli otlar (kalit — normallashtirilgan). */
export const PROPER_NOUNS: Record<string, string> = {
  "o'zbekiston": "O‘zbekiston",
  toshkent: "Toshkent",
  samarqand: "Samarqand",
  buxoro: "Buxoro",
  xiva: "Xiva",
  andijon: "Andijon",
  namangan: "Namangan",
  "farg'ona": "Farg‘ona",
  qarshi: "Qarshi",
  termiz: "Termiz",
  nukus: "Nukus",
  jizzax: "Jizzax",
  guliston: "Guliston",
  urganch: "Urganch",
  "qoraqalpog'iston": "Qoraqalpog‘iston",
  xorazm: "Xorazm",
  surxondaryo: "Surxondaryo",
  qashqadaryo: "Qashqadaryo",
  sirdaryo: "Sirdaryo",
  "qozog'iston": "Qozog‘iston",
  "qirg'iziston": "Qirg‘iziston",
  tojikiston: "Tojikiston",
  turkmaniston: "Turkmaniston",
  rossiya: "Rossiya",
  turkiya: "Turkiya",
};

/** Chiziqcha bilan yoziladigan yuklamalar (alohida yozilgan bo‘lsa). */
export const HYPHEN_PARTICLES = new Set(["chi", "ku", "yu"]);

/** Takrorlanganda xato hisoblanadigan yordamchi so‘zlar (chiziqcha emas, ortiqcha takror). */
export const FUNCTION_WORDS = new Set(["va", "bilan", "ham", "bu", "shu", "u", "men", "sen", "biz", "siz", "uchun", "lekin", "ammo", "esa", "da", "ni", "bir"]);

/** Oldidan vergul qo‘yiladigan bog‘lovchilar. */
export const COMMA_CONJUNCTIONS = new Set(["lekin", "ammo", "biroq", "chunki"]);

/** Nuqta bilan tugaydigan qisqartmalar — keyingi so‘z kichik harf bilan boshlanishi mumkin. */
export const ABBREVIATIONS = new Set(["t.b", "h.k", "va h.k", "m", "y", "sh", "km", "kg", "mln", "mlrd", "so'm", "prof", "dots", "akad", "ya'ni", "b", "r", "a.k", "n"]);
