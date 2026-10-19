import { prisma } from "@/lib/server/db";
import { handle, json } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/session";

/**
 * Imlo tekshiruvi uchun resurslar. Tekshiruvning o‘zi brauzerda bajariladi — matn serverga yuborilmaydi.
 * Faqat tasdiqlangan (namuna bo‘lmagan) juftliklar ishlatiladi.
 */
export const GET = handle(async (req: Request) => {
  const user = await getCurrentUser(req.headers);
  const [pairs, ignore] = await Promise.all([
    prisma.spellingPair.findMany({ where: { status: "VERIFIED", origin: { not: "DEMO" } }, select: { wrongKey: true, correct: true, note: true }, take: 50_000 }),
    user ? prisma.savedItem.findMany({ where: { userId: user.id, ignoreInSpellcheck: true }, select: { key: true } }) : Promise.resolve([]),
  ]);
  return json({ pairs, ignore: ignore.map((i) => i.key) }, { headers: { "cache-control": "private, no-store" } });
});
