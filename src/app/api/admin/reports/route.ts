import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { handle, json, requireStaff } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireStaff(req);
  const status = z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN").parse(new URL(req.url).searchParams.get("status") || undefined);
  const items = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { name: true } },
      comment: { select: { id: true, proposal: true, explanation: true, status: true, user: { select: { name: true } }, discussion: { select: { displayTerm: true } } } },
    },
  });
  return json({ items });
});
