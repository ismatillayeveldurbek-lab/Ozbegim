/**
 * OOXML (DOCX/PPTX/XLSX) XML qismlaridagi matnni o‘girish.
 *
 * Paragraf ichidagi barcha matn elementlari (w:t / a:t / t) birlashtirilib, bitta matn sifatida
 * o‘giriladi; so‘ng har bir chiqish tokeni manbadagi boshlanish nuqtasi joylashgan run’ga
 * qaytariladi. Shu sababli "S" va "h" turli formatdagi run’larda bo‘lsa ham, "Ш" to‘g‘ri chiqadi.
 * XML’ning qolgan qismi (bezaklar, atributlar, formulalar) bayt darajasida o‘zgarmaydi.
 */
import type { Token } from "@/lib/uz/translit";

export function decodeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e: string) => {
    switch (e) {
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "amp":
        return "&";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return e[1] === "x" ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(parseInt(e.slice(1), 10));
    }
  });
}

export function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type TokenizeFn = (text: string) => Token[];

interface TextEl {
  start: number;
  end: number;
  attrs: string;
  text: string;
}

/** Bir guruh (paragraf) matn elementlarini o‘giradi va yangi matnlarini qaytaradi. */
export function redistribute(texts: string[], tokens: Token[]): string[] {
  const starts: number[] = [];
  let acc = 0;
  for (const t of texts) {
    starts.push(acc);
    acc += t.length;
  }
  const out = texts.map(() => "");
  let run = 0;
  for (const tok of tokens) {
    // Token manbada boshlanadigan run’ga yoziladi.
    while (run + 1 < texts.length && tok.srcStart >= starts[run + 1]) run++;
    out[run] += tok.out;
  }
  return out;
}

/**
 * XML ichidagi paragraf (P) va matn (T) elementlari bo‘yicha o‘girish.
 * @param paraTag masalan "w:p", "a:p", "si", "is", "text"
 * @param textTag masalan "w:t", "a:t", "t"
 */
export function transformXmlText(xml: string, paraTag: string, textTag: string, tokenize: TokenizeFn): { xml: string; changed: number } {
  const P = paraTag.replace(":", "\\:");
  const T = textTag.replace(":", "\\:");
  const re = new RegExp(
    `<${P}(?=[\\s>/])[^>]*?/>|<${P}(?=[\\s>])[^>]*>|</${P}>|<${T}(?=[\\s>/])([^>]*?)/>|<${T}(?=[\\s>])([^>]*)>([\\s\\S]*?)</${T}>`,
    "g",
  );
  const stack: TextEl[][] = [];
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  let changed = 0;

  const flush = (group: TextEl[]) => {
    if (!group.length) return;
    const texts = group.map((g) => g.text);
    const full = texts.join("");
    if (!/\p{L}/u.test(full)) return;
    const newTexts = redistribute(texts, tokenize(full));
    group.forEach((g, i) => {
      if (newTexts[i] === g.text) return;
      changed++;
      let attrs = g.attrs;
      if (/^\s|\s$/.test(newTexts[i]) && !/xml:space=/.test(attrs)) attrs += ' xml:space="preserve"';
      replacements.push({ start: g.start, end: g.end, value: `<${textTag}${attrs}>${encodeXml(newTexts[i])}</${textTag}>` });
    });
  };

  for (const m of xml.matchAll(re)) {
    const s = m[0];
    const start = m.index!;
    if (m[3] !== undefined || m[1] !== undefined) {
      const selfClosing = m[3] === undefined;
      const el: TextEl = {
        start,
        end: start + s.length,
        attrs: selfClosing ? m[1] : m[2],
        text: selfClosing ? "" : decodeXml(m[3]),
      };
      if (stack.length) stack[stack.length - 1].push(el);
      else flush([el]);
    } else if (s.startsWith("</")) {
      flush(stack.pop() ?? []);
    } else if (!s.endsWith("/>")) {
      stack.push([]);
    }
  }
  while (stack.length) flush(stack.pop()!);

  if (!replacements.length) return { xml, changed: 0 };
  replacements.sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const r of replacements) {
    out += xml.slice(pos, r.start) + r.value;
    pos = r.end;
  }
  out += xml.slice(pos);
  return { xml: out, changed };
}

/** XML qismidan oddiy matnni ajratadi (yozuvni aniqlash va namunalar uchun). */
export function extractXmlText(xml: string, paraTag: string, textTag: string): string {
  const T = textTag.replace(":", "\\:");
  const P = paraTag.replace(":", "\\:");
  return xml
    .replace(new RegExp(`</${P}>`, "g"), "\n")
    .match(new RegExp(`<${T}(?=[\\s>])[^>]*>[\\s\\S]*?</${T}>|\\n`, "g"))
    ?.map((x) => (x === "\n" ? "\n" : decodeXml(x.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>$/, ""))))
    .join("") ?? "";
}
