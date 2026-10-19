import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { verifyToken } from "@/lib/server/exercises";
import { handle, json, readJson, requireUser } from "@/lib/server/http";

/** Javobni server tekshiradi va urinishni tarixga yozadi. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, z.object({ token: z.string().max(10_000), answer: z.string().max(2000) }));
  const p = verifyToken(body.token);
  const isCorrect = body.answer === p.answer;
  await prisma.exerciseAttempt.create({
    data: { userId: user.id, type: p.t, itemRef: p.ref, prompt: p.prompt, userAnswer: body.answer, correctAnswer: p.answer, isCorrect },
  });
  return json({ isCorrect, correctAnswer: p.answer, explanation: p.explanation });
});
