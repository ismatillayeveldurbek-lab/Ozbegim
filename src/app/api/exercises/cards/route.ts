import { prisma } from "@/lib/server/db";
import { handle, json, requireUser } from "@/lib/server/http";

/** Takrorlash vaqti kelgan kartochkalar (shaxsiy lug‘atdan). */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  // Eski yozuvlarda takrorlash holati bo‘lmasa, yaratib qo‘yamiz.
  const missing = await prisma.savedItem.findMany({ where: { userId: user.id, review: null }, select: { id: true } });
  if (missing.length) await prisma.reviewState.createMany({ data: missing.map((m) => ({ savedItemId: m.id })), skipDuplicates: true });
  const cards = await prisma.savedItem.findMany({
    where: { userId: user.id, review: { dueAt: { lte: new Date() } } },
    include: { review: true },
    orderBy: { review: { dueAt: "asc" } },
    take: 30,
  });
  const next = await prisma.reviewState.findFirst({ where: { savedItem: { userId: user.id }, dueAt: { gt: new Date() } }, orderBy: { dueAt: "asc" } });
  return json({
    cards: cards.map((c) => ({ id: c.id, term: c.term, meaning: c.meaning, note: c.note, kind: c.kind, repetitions: c.review?.repetitions ?? 0 })),
    nextDueAt: next?.dueAt ?? null,
  });
});
