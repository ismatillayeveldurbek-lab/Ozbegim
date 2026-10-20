/**
 * AI javobidan JSON’ni xavfsiz ajratish: ```json ... ``` belgilari va atrofdagi matn olib
 * tashlanadi, birinchi to‘liq {...} obyekt parse qilinadi. Xato bo‘lsa null qaytadi (istisno emas).
 */
export function parseAiJson(raw: string): unknown | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/^﻿/, "");
  // Markdown kod bloki: ```json ... ``` yoki ``` ... ```
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    // Matn ichidan birinchi muvozanatli {...} obyektni qidiramiz (satrlar ichidagi qavslar hisobga olinadi).
    const start = s.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
