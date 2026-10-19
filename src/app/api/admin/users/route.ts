import { prisma } from "@/lib/server/db";
import { handle, json, requireAdmin } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const items = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ items });
});
