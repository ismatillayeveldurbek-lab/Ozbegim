import { candidateRootKeys, type LexiconEntry } from "@/lib/uz/analysis/morphology";
import { prisma } from "./db";

/** Berilgan so‘zlar uchun kerakli lug‘at yozuvlarini yuklaydi (rad etilganlarsiz). */
export async function loadLexicon(words: string[]): Promise<Map<string, LexiconEntry[]>> {
  const keys = new Set<string>();
  for (const w of words) for (const k of candidateRootKeys(w)) keys.add(k);
  const rows = await prisma.lexeme.findMany({
    where: { key: { in: [...keys].slice(0, 5000) }, status: { not: "REJECTED" } },
    select: { lemma: true, key: true, pos: true, meaning: true, status: true, origin: true, examples: true },
  });
  const map = new Map<string, LexiconEntry[]>();
  for (const r of rows) map.set(r.key, [...(map.get(r.key) ?? []), r]);
  return map;
}
