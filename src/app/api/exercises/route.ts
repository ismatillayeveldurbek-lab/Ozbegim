import { prisma } from "@/lib/server/db";
import { availability, EXERCISE_TYPES, MIN_ITEMS } from "@/lib/server/exercises";
import { handle, json, requireUser } from "@/lib/server/http";

/** Mashqlar holati: mavjud savollar soni, natijalar va xatolar tarixi. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const [avail, grouped, mistakes, due, totalCards] = await Promise.all([
    availability(),
    prisma.exerciseAttempt.groupBy({ by: ["type", "isCorrect"], where: { userId: user.id }, _count: true }),
    prisma.exerciseAttempt.findMany({ where: { userId: user.id, isCorrect: false }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.reviewState.count({ where: { savedItem: { userId: user.id }, dueAt: { lte: new Date() } } }),
    prisma.savedItem.count({ where: { userId: user.id } }),
  ]);
  const stats = Object.fromEntries(
    [...EXERCISE_TYPES, "flashcard"].map((t) => {
      const ok = grouped.find((g) => g.type === t && g.isCorrect)?._count ?? 0;
      const bad = grouped.find((g) => g.type === t && !g.isCorrect)?._count ?? 0;
      return [t, { correct: ok, wrong: bad }];
    }),
  );
  return json({ availability: avail, minItems: MIN_ITEMS, stats, mistakes, cards: { due, total: totalCards } });
});
