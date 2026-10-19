import { prisma } from "@/lib/server/db";
import { handle, json, requireAdmin } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true, email: true } } } });
  return json({ items });
});
