/**
 * DOCX, XLSX, PPTX: faqat matn elementlari o‘zgartiriladi, qolgan barcha qismlar
 * (bezaklar, rasmlar, formulalar, sonlar, sanalar) asl holicha qoladi.
 */
import JSZip from "jszip";
import { transliterate, type TranslitOptions } from "@/lib/uz/translit";
import { extractXmlText, transformXmlText } from "../ooxml-text";

type Opts = Omit<TranslitOptions, "withTokens">;

interface PartRule {
  pattern: RegExp;
  para: string;
  text: string;
}

const RULES: Record<"docx" | "pptx" | "xlsx", PartRule[]> = {
  docx: [{ pattern: /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/, para: "w:p", text: "w:t" }],
  pptx: [{ pattern: /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/, para: "a:p", text: "a:t" }],
  xlsx: [
    { pattern: /^xl\/sharedStrings\.xml$/, para: "si", text: "t" },
    { pattern: /^xl\/worksheets\/sheet\d+\.xml$/, para: "is", text: "t" },
    { pattern: /^xl\/comments\d*\.xml$/, para: "text", text: "t" },
  ],
};

const UNSUPPORTED_PARTS: Array<[RegExp, string]> = [
  [/\/charts\//, "Diagrammalar (chart) ichidagi matn o‘girilmadi."],
  [/\/diagrams\//, "SmartArt diagrammalari ichidagi matn o‘girilmadi."],
  [/\/embeddings\//, "Hujjatga joylashtirilgan boshqa fayllar (embedded) o‘zgartirilmadi."],
  [/^word\/media\/|^ppt\/media\/|^xl\/media\//, "Rasmlar ichidagi yozuvlar o‘zgartirilmaydi."],
];

export async function officeSampleText(kind: "docx" | "pptx" | "xlsx", buf: Buffer, max = 20000): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  let text = "";
  for (const rule of RULES[kind]) {
    for (const name of Object.keys(zip.files).filter((n) => rule.pattern.test(n))) {
      text += extractXmlText(await zip.file(name)!.async("string"), rule.para, rule.text) + "\n";
      if (text.length > max) return text.slice(0, max);
    }
  }
  return text;
}

export async function convertOffice(kind: "docx" | "pptx" | "xlsx", buf: Buffer, opts: Opts): Promise<{ data: Buffer; warnings: string[]; changedElements: number }> {
  const zip = await JSZip.loadAsync(buf);
  const warnings = new Set<string>();
  let changedElements = 0;
  const tokenize = (s: string) => transliterate(s, { ...opts, withTokens: true }).tokens!;
  const names = Object.keys(zip.files);

  for (const name of names) {
    const file = zip.file(name);
    if (!file) continue;
    for (const [re, msg] of UNSUPPORTED_PARTS) if (re.test(name)) warnings.add(msg);
    const rule = RULES[kind].find((r) => r.pattern.test(name));
    if (!rule) continue;
    const xml = await file.async("string");
    const r = transformXmlText(xml, rule.para, rule.text, tokenize);
    if (r.changed) {
      changedElements += r.changed;
      zip.file(name, r.xml);
    }
    if (kind === "xlsx" && /^xl\/worksheets\//.test(name) && /<c\b[^>]*\bt="str"/.test(xml))
      warnings.add("Formulalar natijasi bo‘lgan matnlar Excel’da qayta hisoblangandan keyin yangilanadi; formulalarning o‘zi o‘zgartirilmadi.");
  }
  if (kind === "xlsx") warnings.add("Varaq nomlari formulalardagi havolalar buzilmasligi uchun o‘zgartirilmadi.");
  if (kind === "docx" && names.some((n) => /^word\/document\.xml$/.test(n))) {
    const doc = await zip.file("word/document.xml")!.async("string");
    if (/<w:instrText/.test(doc)) warnings.add("Maydon kodlari (masalan, giperhavola manzillari) o‘zgartirilmadi.");
  }

  const data = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: undefined });
  return { data, warnings: [...warnings], changedElements };
}
