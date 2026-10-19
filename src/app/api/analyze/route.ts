import { z } from "zod";
import { analyzeWord, inferPos } from "@/lib/uz/analysis/morphology";
import { letterReport, syllabify } from "@/lib/uz/analysis/phonetics";
import { analyzeSentence } from "@/lib/uz/analysis/sentence";
import { normalizeKey } from "@/lib/uz/normalize";
import { transliterate } from "@/lib/uz/translit";
import { loadLexicon } from "@/lib/server/analysis";
import { prisma } from "@/lib/server/db";
import { clientIp, handle, HttpError, json } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** So‘z yoki gap tahlili (qoidaviy + lug‘at). Matn saqlanmaydi. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const mode = z.enum(["word", "sentence"]).parse(url.searchParams.get("mode") ?? "word");
  const input = (url.searchParams.get("q") ?? "").trim().slice(0, 500);
  if (!input) throw new HttpError(400, "Tahlil uchun so‘z yoki gap kiriting.");
  await enforceRateLimit(`analyze:${clientIp(req)}`, 120, 60);

  // Kirill yozuvidagi kiritish lotinga o‘giriladi (tahlil qoidalari lotin yozuvida).
  const latin = /[Ѐ-ӿ]/.test(input) ? transliterate(input, { direction: "cyr2lat", protect: false }).text : input;

  if (mode === "word") {
    const word = latin.split(/\s+/)[0];
    if (!/\p{L}/u.test(word)) throw new HttpError(400, "So‘z harflardan iborat bo‘lsin.");
    const lexicon = await loadLexicon([word]);
    const analyses = analyzeWord(word, lexicon).map((a) => ({ ...a, inferredPos: a.pos ?? inferPos(a) }));
    const rootKeys = [...new Set(analyses.filter((a) => a.basis === "lug‘at").map((a) => a.rootKey))];
    const examples = rootKeys.length
      ? (await prisma.lexeme.findMany({ where: { key: { in: rootKeys } }, select: { lemma: true, examples: true } })).flatMap((l) => l.examples.map((e) => ({ lemma: l.lemma, text: e })))
      : [];
    return json({
      mode,
      input,
      word,
      key: normalizeKey(word),
      cyrillic: transliterate(word, { direction: "lat2cyr", protect: false }).text,
      syllables: syllabify(word),
      letters: letterReport(word),
      analyses,
      examples: examples.slice(0, 10),
      ambiguous: analyses.length > 1,
      lexiconFound: analyses.some((a) => a.basis === "lug‘at"),
    });
  }
  const words = latin.match(/\p{L}+(?:['`‘’ʻʼ-]\p{L}+)*/gu) ?? [];
  const lexicon = await loadLexicon(words);
  return json({ mode, input, ...analyzeSentence(latin, lexicon) });
});
