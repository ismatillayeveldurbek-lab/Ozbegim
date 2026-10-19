import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";

export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const r = await prisma.historyEntry.deleteMany({ where: { id, userId: user.id } });
  if (!r.count) throw new HttpError(404, "Yozuv topilmadi.");
  return json({ ok: true });
});
