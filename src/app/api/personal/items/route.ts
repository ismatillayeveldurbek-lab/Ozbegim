import type { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/server/db";
import { handle, json, readJson, requireUser } from "@/lib/server/http";
import { recordHistory } from "@/lib/server/history";
import { assertFolder, itemInclude, itemInput, normalizeKey, serializeItem, setTags } from "@/lib/server/personal";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** Faqat egasining yozuvlari qaytariladi. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const folderId = url.searchParams.get("folderId") || undefined;
  const tag = url.searchParams.get("tag") || undefined;
  const where: Prisma.SavedItemWhereInput = {
    userId: user.id,
    ...(folderId ? { folderId } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    ...(q
      ? { OR: [{ key: { contains: normalizeKey(q) } }, { meaning: { contains: q, mode: "insensitive" } }, { note: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const [items, folders, tags] = await Promise.all([
    prisma.savedItem.findMany({ where, include: itemInclude, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.folder.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, include: { _count: { select: { items: true } } } }),
    prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);
  return json({ items: items.map(serializeItem), folders: folders.map((f) => ({ id: f.id, name: f.name, count: f._count.items })), tags: tags.map((t) => t.name) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req, itemInput);
  await enforceRateLimit(`personal:${user.id}`, 200, 3600);
  await assertFolder(user.id, body.folderId);
  const key = normalizeKey(body.term);
  const existing = await prisma.savedItem.findUnique({ where: { userId_kind_key: { userId: user.id, kind: body.kind, key } } });
  const item = existing
    ? await prisma.savedItem.update({
        where: { id: existing.id },
        data: { ignoreInSpellcheck: body.ignoreInSpellcheck ?? existing.ignoreInSpellcheck, meaning: existing.meaning ?? body.meaning },
      })
    : await prisma.savedItem.create({
        data: {
          userId: user.id,
          kind: body.kind,
          term: body.term,
          key,
          meaning: body.meaning,
          note: body.note,
          refId: body.refId,
          folderId: body.folderId ?? null,
          ignoreInSpellcheck: body.ignoreInSpellcheck ?? false,
          review: { create: {} },
        },
      });
  if (body.tags) await setTags(user.id, item.id, body.tags);
  if (!existing) await recordHistory(user, { type: "saved", summary: `Saqlandi: ${body.term}`, meta: { kind: body.kind } });
  const full = await prisma.savedItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude });
  return json(serializeItem(full), { status: existing ? 200 : 201 });
});
