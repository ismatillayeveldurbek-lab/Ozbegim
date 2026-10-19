import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireStaff } from "@/lib/server/http";

const STATUS = { show: "VISIBLE", hide: "HIDDEN", reject: "REJECTED", accept: "ACCEPTED" } as const;

/** Izohni ko‘rsatish, yashirish, rad etish yoki qabul qilish. */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await params;
  const body = await readJson(req, z.object({ action: z.enum(["show", "hide", "reject", "accept"]), note: z.string().trim().max(500).optional() }));
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new HttpError(404, "Izoh topilmadi.");
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id },
      data: { status: STATUS[body.action], moderationNote: body.note ?? null, moderatedById: staff.id, moderatedAt: new Date() },
    });
    // Izoh bo‘yicha ochiq shikoyatlar qaror bilan yopiladi.
    await tx.report.updateMany({
      where: { commentId: id, status: "OPEN" },
      data: { status: body.action === "show" || body.action === "accept" ? "DISMISSED" : "RESOLVED", decision: `comment_${body.action}`, resolvedById: staff.id, resolvedAt: new Date() },
    });
    await audit(staff.id, `comment.${body.action}`, "Comment", id, { from: comment.status, note: body.note }, tx);
  });
  return json({ ok: true });
});
