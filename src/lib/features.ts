/** Imkoniyatlar holati — /holat sahifasida va README’da bir xil ko‘rsatiladi. */
export type FeatureLevel = "works" | "limited" | "not_connected";

export const FEATURES: Array<{ name: string; level: FeatureLevel; note: string }> = [
  { name: "Lotin ↔ kirill (matn)", level: "works", note: "Brauzerda, Web Worker bilan; himoyalangan parchalar; tekshirish belgilari." },
  { name: "Fayl konvertatsiyasi (TXT, CSV, DOCX, XLSX, PPTX, SRT, VTT)", level: "works", note: "Fon ishchisi yoki inline rejim; asl fayl o‘zgarmaydi." },
  { name: "Matnli PDF", level: "limited", note: "Matn ajratiladi va tahrirlanadi; joylashuv saqlanmaydi (TXT/DOCX)." },
  { name: "Iboralar va o‘zlashma so‘zlar qidiruvi", level: "works", note: "Lotin/kirill, apostrof variantlari, yaqin natijalar (pg_trgm)." },
  { name: "Izohlar, ovozlar, shikoyatlar, moderatsiya", level: "works", note: "Rate limit, spam filtrlari, avtomatik yashirish." },
  { name: "Imlo tekshiruvi (qoidaviy)", level: "limited", note: "To‘liq lug‘at ulanmagan; faqat aniq qoidalar va ro‘yxatlar." },
  { name: "So‘z va gap tahlili", level: "limited", note: "Qoidaviy va lug‘atga asoslangan; lug‘at to‘ldirilgani sari aniqlashadi." },
  { name: "Shaxsiy lug‘at, mashqlar, kartochkalar", level: "works", note: "Mashqlar faqat tasdiqlangan ma’lumotdan." },
  { name: "Matn statistikasi, ish tarixi", level: "works", note: "Tarix faqat rozilik bilan." },
  { name: "Admin: import/eksport, zaxira, audit", level: "works", note: "Import bitta tranzaksiyada." },
];
