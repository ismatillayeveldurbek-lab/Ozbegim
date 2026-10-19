import { z } from "zod";
import { deleteEntry, parseType, saveEntry } from "@/lib/server/admin-entries";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, readJson, requireAdmin } from "@/lib/server/http";

type Ctx = { params: Promise<{ type: string; id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await params;
  const type = parseType(p.type);
  const body = await readJson(req, z.unknown(), 200_000);
  const saved = await prisma.$transaction(async (tx) => {
    const s = await saveEntry(tx, type, body, p.id).catch((e) => {
      if ((e as { code?: string }).code === "P2025") throw new HttpError(404, "Yozuv topilmadi.");
      throw e;
    });
    await audit(admin.id, `${type}.update`, type, p.id, { status: (body as { status?: string })?.status }, tx);
    return s;
  });
  return json({ id: saved.id });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await params;
  const type = parseType(p.type);
  await deleteEntry(type, p.id);
  await audit(admin.id, `${type}.delete`, type, p.id);
  return json({ ok: true });
});
