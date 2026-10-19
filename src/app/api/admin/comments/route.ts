import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { handle, json, requireStaff } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireStaff(req);
  const url = new URL(req.url);
  const status = z.enum(["VISIBLE", "HIDDEN", "REJECTED", "ACCEPTED"]).optional().parse(url.searchParams.get("status") || undefined);
  const items = await prisma.comment.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      discussion: { select: { kind: true, displayTerm: true, key: true, loanwordId: true } },
      _count: { select: { reports: { where: { status: "OPEN" } } } },
    },
  });
  return json({ items });
});
