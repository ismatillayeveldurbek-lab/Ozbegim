import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { handle, json, readJson, requireUser } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  return json(user);
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, z.object({ historyMode: z.enum(["off", "meta", "full"]).optional(), name: z.string().trim().min(2).max(80).optional() }));
  await prisma.user.update({ where: { id: user.id }, data: body });
  // Matnli tarix o‘chirilsa, avval saqlangan matnlar ham tozalanadi.
  if (body.historyMode === "meta") await prisma.historyEntry.updateMany({ where: { userId: user.id }, data: { inputText: null, outputText: null } });
  return json({ ok: true });
});
