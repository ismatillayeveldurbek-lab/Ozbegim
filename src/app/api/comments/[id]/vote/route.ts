import { z } from "zod";
import { recomputeScore } from "@/lib/server/comments";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** Ovoz berish. Ovozlar soni yozuvni avtomatik "Tasdiqlangan" qilmaydi — faqat tartiblash uchun. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { value } = await readJson(req, z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }));
  await enforceRateLimit(`vote:${user.id}`, 60, 600);
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || !["VISIBLE", "ACCEPTED"].includes(comment.status)) throw new HttpError(404, "Izoh topilmadi.");
  if (comment.userId === user.id) throw new HttpError(400, "O‘z izohingizga ovoz bera olmaysiz.");
  if (value === 0) await prisma.commentVote.deleteMany({ where: { commentId: id, userId: user.id } });
  else
    await prisma.commentVote.upsert({
      where: { commentId_userId: { commentId: id, userId: user.id } },
      create: { commentId: id, userId: user.id, value },
      update: { value },
    });
  return json({ score: await recomputeScore(id), myVote: value });
});
