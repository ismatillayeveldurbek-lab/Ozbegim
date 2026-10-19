import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { assertFolder, itemInclude, itemPatch, serializeItem, setTags } from "@/lib/server/personal";

type Ctx = { params: Promise<{ id: string }> };

async function own(req: Request, ctx: Ctx) {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const item = await prisma.savedItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) throw new HttpError(404, "Yozuv topilmadi.");
  return { user, item };
}

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { item } = await own(req, ctx);
  return json(serializeItem(await prisma.savedItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude })));
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { user, item } = await own(req, ctx);
  const body = await readJson(req, itemPatch);
  await assertFolder(user.id, body.folderId);
  const { tags, ...data } = body;
  await prisma.savedItem.update({ where: { id: item.id }, data });
  if (tags) await setTags(user.id, item.id, tags);
  return json(serializeItem(await prisma.savedItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude })));
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { item } = await own(req, ctx);
  await prisma.savedItem.delete({ where: { id: item.id } });
  return json({ ok: true });
});
