import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireAdmin } from "@/lib/server/http";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const body = await readJson(req, z.object({ role: z.enum(["user", "moderator", "admin"]).optional(), banned: z.boolean().optional() }));
  if (id === admin.id) throw new HttpError(400, "O‘z rolingizni yoki holatingizni o‘zgartira olmaysiz.");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "Foydalanuvchi topilmadi.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: body });
    if (body.banned) await tx.session.deleteMany({ where: { userId: id } });
    await audit(admin.id, "user.update", "User", id, { from: { role: target.role, banned: target.banned }, to: body }, tx);
  });
  return json({ ok: true });
});
