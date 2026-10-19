import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireStaff } from "@/lib/server/http";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await params;
  const { action } = await readJson(req, z.object({ action: z.enum(["dismiss", "hide_comment", "reject_comment"]) }));
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw new HttpError(404, "Shikoyat topilmadi.");
  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id },
      data: { status: action === "dismiss" ? "DISMISSED" : "RESOLVED", decision: action, resolvedById: staff.id, resolvedAt: new Date() },
    });
    if (action !== "dismiss") {
      await tx.comment.update({
        where: { id: report.commentId },
        data: { status: action === "hide_comment" ? "HIDDEN" : "REJECTED", moderatedById: staff.id, moderatedAt: new Date() },
      });
    }
    await audit(staff.id, `report.${action}`, "Report", id, { commentId: report.commentId }, tx);
  });
  return json({ ok: true });
});
