/// <reference lib="webworker" />
import { transliterate, type TranslitOptions } from "@/lib/uz/translit";
import { detectScript } from "@/lib/uz/script";

interface Req {
  id: number;
  text: string;
  options: TranslitOptions;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, text, options } = e.data;
  const r = transliterate(text, options);
  (self as unknown as Worker).postMessage({
    id,
    text: r.text,
    flags: r.flags.slice(0, 500),
    flagCount: r.flags.length,
    protectedCount: r.protectedRanges.length,
    script: detectScript(text),
  });
};
