/** Formatlar bo‘yicha qo‘llab-quvvatlash jadvali (interfeysda ko‘rsatiladi). */
export type SupportLevel = "works" | "limited" | "not_connected" | "unsupported";

export interface FormatInfo {
  format: string;
  label: string;
  level: SupportLevel;
  note: string;
}

export const FORMAT_TABLE: FormatInfo[] = [
  { format: "TXT", label: "Matn fayli", level: "works", note: "UTF-8 yoki Windows-1251; natija UTF-8." },
  { format: "CSV", label: "Jadval (matn)", level: "works", note: "Ajratgich, qo‘shtirnoqlar va qatorlar tuzilishi saqlanadi." },
  { format: "DOCX", label: "Word hujjati", level: "works", note: "Bezaklar saqlanadi; run’lar orasida bo‘lingan harf birikmalari hisobga olinadi. Diagramma va SmartArt matni o‘girilmaydi." },
  { format: "XLSX", label: "Excel kitobi", level: "works", note: "Faqat matnli kataklar; formulalar, sonlar va sanalar o‘zgarmaydi. Varaq nomlari saqlanadi." },
  { format: "PPTX", label: "PowerPoint taqdimoti", level: "works", note: "Slayd va izoh matnlari; diagrammalar o‘girilmaydi." },
  { format: "SRT / VTT", label: "Subtitrlar", level: "works", note: "Vaqt belgilari, cue identifikatorlari va teglar saqlanadi." },
  { format: "PDF (matnli)", label: "PDF", level: "limited", note: "Matn ajratiladi, siz tekshirib tahrirlaysiz; asl joylashuv saqlanmaydi — natija TXT yoki DOCX." },
  { format: "PDF (skanerlangan)", label: "PDF", level: "not_connected", note: "OCR xizmati (Tesseract + poppler-utils) kerak." },
  { format: "JPG / PNG", label: "Rasm", level: "not_connected", note: "Rasmdan matn ajratish uchun OCR xizmati kerak." },
  { format: "Rasmdagi yozuvni almashtirish", label: "Rasm", level: "unsupported", note: "Amalga oshirilmagan." },
  { format: "DOC / XLS / PPT", label: "Eski Office", level: "unsupported", note: "Avval .docx / .xlsx / .pptx sifatida qayta saqlang." },
  { format: "Audio / video", label: "Media", level: "not_connected", note: "Avval transkripsiya kerak; xizmat ulanmagan." },
];
