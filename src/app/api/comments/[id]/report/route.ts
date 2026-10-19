import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { AUTO_HIDE_REPORTS } from "@/lib/server/comments";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const body = await readJson(
    req,
    z.object({ reason: z.enum(["SPAM", "OFFENSIVE", "WRONG", "OTHER"]), details: z.string().trim().max(500).optional() }),
  );
  await enforceRateLimit(`report:${user.id}`, 10, 3600);
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new HttpError(404, "Izoh topilmadi.");
  if (comment.userId === user.id) throw new HttpError(400, "O‘z izohingiz ustidan shikoyat qila olmaysiz.");
  try {
    await prisma.report.create({ data: { commentId: id, reporterId: user.id, reason: body.reason, details: body.details || null } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "Siz bu izoh ustidan allaqachon shikoyat qilgansiz.");
    throw e;
  }
  const open = await prisma.report.count({ where: { commentId: id, status: "OPEN" } });
  if (open >= AUTO_HIDE_REPORTS && comment.status === "VISIBLE") {
    await prisma.comment.update({ where: { id }, data: { status: "HIDDEN", moderationNote: "Shikoyatlar sababli vaqtincha yashirildi" } });
    await audit(null, "comment.auto_hidden", "Comment", id, { openReports: open });
  }
  return json({ ok: true }, { status: 201 });
});
