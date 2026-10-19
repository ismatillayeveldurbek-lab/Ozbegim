import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { recordHistory } from "@/lib/server/history";
import { handle, HttpError, json, readJson, requireUser } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const items = await prisma.historyEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return json({ mode: user.historyMode, items });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(
    req,
    z.object({
      type: z.enum(["convert", "spellcheck", "file", "saved"]),
      summary: z.string().trim().min(1).max(300),
      inputText: z.string().max(200_000).optional(),
      outputText: z.string().max(200_000).optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }),
    1_000_000,
  );
  if (user.historyMode === "off") throw new HttpError(409, "Ish tarixi o‘chirilgan. Uni “Profil va sozlamalar” sahifasida yoqishingiz mumkin.", "HISTORY_OFF");
  const e = await recordHistory(user, body);
  return json({ id: e?.id, savedText: user.historyMode === "full" }, { status: 201 });
});

/** Butun tarixni o‘chirish. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  const r = await prisma.historyEntry.deleteMany({ where: { userId: user.id } });
  return json({ deleted: r.count });
});
