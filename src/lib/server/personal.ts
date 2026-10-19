import { z } from "zod";
import { normalizeKey } from "@/lib/uz/normalize";
import { prisma } from "./db";
import { HttpError } from "./http";

export const itemInput = z.object({
  kind: z.enum(["WORD", "IDIOM", "LOANWORD"]),
  term: z.string().trim().min(1).max(200),
  meaning: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
  refId: z.string().max(40).optional(),
  folderId: z.string().max(40).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  ignoreInSpellcheck: z.boolean().optional(),
});

export const itemPatch = itemInput.omit({ kind: true, term: true, refId: true }).partial();

export const itemInclude = { folder: { select: { id: true, name: true } }, tags: { include: { tag: { select: { name: true } } } }, review: true } as const;

/** Papka foydalanuvchiga tegishli ekanini tekshiradi. */
export async function assertFolder(userId: string, folderId: string | null | undefined) {
  if (!folderId) return;
  const f = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!f || f.userId !== userId) throw new HttpError(404, "Papka topilmadi.");
}

export async function setTags(userId: string, itemId: string, names: string[]) {
  await prisma.savedItemTag.deleteMany({ where: { savedItemId: itemId } });
  for (const name of [...new Set(names)]) {
    const tag = await prisma.tag.upsert({ where: { userId_name: { userId, name } }, create: { userId, name }, update: {} });
    await prisma.savedItemTag.create({ data: { savedItemId: itemId, tagId: tag.id } });
  }
}

export function serializeItem(i: Awaited<ReturnType<typeof prisma.savedItem.findFirstOrThrow<{ where: object; include: typeof itemInclude }>>>) {
  return {
    id: i.id,
    kind: i.kind,
    term: i.term,
    meaning: i.meaning,
    note: i.note,
    ignoreInSpellcheck: i.ignoreInSpellcheck,
    folder: i.folder,
    tags: i.tags.map((t) => t.tag.name),
    dueAt: i.review?.dueAt.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

export { normalizeKey };
