import { z } from "zod";
import { schedule } from "@/lib/exercises/sm2";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";

/** Kartochka bahosi: keyingi takrorlash vaqti natijaga qarab rejalashtiriladi. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { grade } = await readJson(req, z.object({ grade: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]) }));
  const item = await prisma.savedItem.findUnique({ where: { id }, include: { review: true } });
  if (!item || item.userId !== user.id) throw new HttpError(404, "Kartochka topilmadi.");
  const current = item.review ?? { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
  const next = schedule(current, grade);
  await prisma.$transaction([
    prisma.reviewState.upsert({
      where: { savedItemId: id },
      create: { savedItemId: id, ...next, lastReviewedAt: new Date() },
      update: { ...next, lastReviewedAt: new Date() },
    }),
    prisma.exerciseAttempt.create({
      data: { userId: user.id, type: "flashcard", itemRef: id, prompt: item.term, userAnswer: String(grade), correctAnswer: item.meaning ?? "", isCorrect: grade >= 3 },
    }),
  ]);
  return json({ dueAt: next.dueAt, intervalDays: next.intervalDays });
});
