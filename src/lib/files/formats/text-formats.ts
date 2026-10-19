/**
 * TXT, CSV, SRT va VTT fayllarini o‘girish.
 */
import { transliterate, type TranslitOptions } from "@/lib/uz/translit";

type Opts = Omit<TranslitOptions, "withTokens">;

export function convertPlain(text: string, opts: Opts): string {
  return transliterate(text, opts).text;
}

/** CSV ajratgichini birinchi qator bo‘yicha aniqlash (qo‘shtirnoq ichidagilar hisobga olinmaydi). */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let inQ = false;
  for (const ch of text.slice(0, 20000)) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === "\n") break;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

/**
 * CSV: faqat maydon mazmuni o‘giriladi. Ajratgich, qo‘shtirnoqlar, "" ekranlash va
 * qator oxiri belgilari (\n yoki \r\n) aynan saqlanadi.
 */
export function convertCsv(text: string, opts: Opts): { text: string; rows: number; delimiter: string } {
  const delim = detectDelimiter(text);
  let out = "";
  let i = 0;
  let rows = 0;
  const n = text.length;
  // "=" bilan boshlanuvchi maydon — jadval formulasi, o‘zgartirilmaydi.
  const conv = (s: string) => (!s || /^\s*=/.test(s) ? s : transliterate(s, opts).text);
  while (i < n) {
    // Bitta maydon
    if (text[i] === '"') {
      let j = i + 1;
      let content = "";
      for (;;) {
        if (j >= n) break; // yopilmagan qo‘shtirnoq — oxirigacha
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            content += '"';
            j += 2;
            continue;
          }
          break;
        }
        content += text[j++];
      }
      const closed = j < n;
      out += '"' + conv(content).replace(/"/g, '""') + (closed ? '"' : "");
      i = closed ? j + 1 : j;
    } else {
      let j = i;
      while (j < n && text[j] !== delim && text[j] !== "\n" && text[j] !== "\r") j++;
      out += conv(text.slice(i, j));
      i = j;
    }
    // Maydondan keyingi belgi: ajratgich yoki qator oxiri
    if (i < n) {
      if (text[i] === delim) {
        out += delim;
        i++;
        if (i === n) break;
      } else if (text[i] === "\r" || text[i] === "\n") {
        const nl = text[i] === "\r" && text[i + 1] === "\n" ? "\r\n" : text[i];
        out += nl;
        i += nl.length;
        rows++;
      } else {
        // Qo‘shtirnoqdan keyin kutilmagan belgi — o‘zgarishsiz qo‘shamiz
        out += text[i++];
      }
    }
  }
  if (text.length && !/[\r\n]$/.test(text)) rows++;
  return { text: out, rows, delimiter: delim };
}

const TAG_RE = /(<[^>\n]*>|\{\\[^}\n]*\}|&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/;

function convertCueLine(line: string, opts: Opts): string {
  return line
    .split(TAG_RE)
    .map((part, idx) => (idx % 2 === 1 ? part : part ? transliterate(part, opts).text : part))
    .join("");
}

/** SRT: raqamli cue identifikatorlari va vaqt belgilari o‘zgarmaydi; teglar saqlanadi. */
export function convertSrt(text: string, opts: Opts): { text: string; cues: number } {
  let cues = 0;
  const lines = text.split(/(\r\n|\n)/);
  for (let k = 0; k < lines.length; k += 2) {
    const line = lines[k];
    if (/-->/.test(line)) {
      cues++;
      continue;
    }
    if (/^\s*\d+\s*$/.test(line) || !line.trim()) continue;
    lines[k] = convertCueLine(line, opts);
  }
  return { text: lines.join(""), cues };
}

/**
 * VTT: WEBVTT sarlavhasi, NOTE/STYLE/REGION bloklari, cue identifikatorlari (vaqt qatoridan
 * oldingi qator) va vaqt qatori (sozlamalari bilan) o‘zgarmaydi.
 */
export function convertVtt(text: string, opts: Opts): { text: string; cues: number } {
  const parts = text.split(/(\r\n|\n)/);
  const lines: string[] = [];
  const seps: string[] = [];
  for (let k = 0; k < parts.length; k += 2) {
    lines.push(parts[k]);
    seps.push(parts[k + 1] ?? "");
  }
  let cues = 0;
  let block: "header" | "meta" | "cue" | "none" = "header";
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    if (!line.trim()) {
      block = "none";
      continue;
    }
    if (block === "header") continue;
    if (block === "none") {
      if (/^(NOTE|STYLE|REGION)(\s|$)/.test(line)) {
        block = "meta";
        continue;
      }
      if (/-->/.test(line)) {
        block = "cue";
        cues++;
        continue;
      }
      if (lines[k + 1] !== undefined && /-->/.test(lines[k + 1])) continue; // cue identifikatori
      block = "cue";
    }
    if (block === "meta") continue;
    if (block === "cue") {
      if (/-->/.test(line)) {
        cues++;
        continue;
      }
      lines[k] = convertCueLine(line, opts);
    }
  }
  return { text: lines.map((l, i) => l + seps[i]).join(""), cues };
}
