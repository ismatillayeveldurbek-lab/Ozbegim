import { listEntries, listQuery, parseType, saveEntry } from "@/lib/server/admin-entries";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, json, readJson, requireAdmin } from "@/lib/server/http";
import { z } from "zod";

type Ctx = { params: Promise<{ type: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin(req);
  const type = parseType((await params).type);
  const url = new URL(req.url);
  const q = listQuery.parse(Object.fromEntries([...url.searchParams].filter(([, v]) => v !== "")));
  return json(await listEntries(type, q));
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin(req);
  const type = parseType((await params).type);
  const body = await readJson(req, z.unknown(), 200_000);
  const saved = await prisma.$transaction(async (tx) => {
    const s = await saveEntry(tx, type, body);
    await audit(admin.id, `${type}.create`, type, s.id, {}, tx);
    return s;
  });
  return json({ id: saved.id }, { status: 201 });
});
