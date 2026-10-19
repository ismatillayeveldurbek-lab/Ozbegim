import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { name } = await readJson(req, z.object({ name: z.string().trim().min(1, "Papka nomini yozing").max(60) }));
  if ((await prisma.folder.count({ where: { userId: user.id } })) >= 100) throw new HttpError(400, "Papkalar soni chegarasiga yetdingiz.");
  try {
    const f = await prisma.folder.create({ data: { userId: user.id, name } });
    return json({ id: f.id, name: f.name }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "Bunday nomli papka bor.");
    throw e;
  }
});
