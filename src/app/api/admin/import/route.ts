import { z } from "zod";
import type { Prisma } from "@generated/prisma/client";
import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, json, requireAdmin } from "@/lib/server/http";
import { FIELDS, parseImportFile } from "@/lib/server/importer";

/** 1-qadam: fayl yuklash va varaqlarni o‘qish. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  if (Number(req.headers.get("content-length") ?? 0) > 15 * 1024 * 1024) throw new HttpError(413, "Import fayli 15 MB dan oshmasin.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Fayl yuborilmadi.");
  const target = z.enum(["idiom", "loanword", "lexeme", "spelling"]).parse(form?.get("target"));
  const sheets = await parseImportFile(file.name, Buffer.from(await file.arrayBuffer()));
  const job = await prisma.importJob.create({ data: { actorId: admin.id, fileName: file.name.slice(0, 200), target, sheets: sheets as unknown as Prisma.InputJsonValue } });
  await audit(admin.id, "import.upload", "ImportJob", job.id, { target, fileName: file.name, sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.length })) });
  return json(
    {
      id: job.id,
      fields: FIELDS[target],
      sheets: sheets.map((s) => ({ name: s.name, headers: s.headers, rowCount: s.rows.length, sample: s.rows.slice(0, 5) })),
    },
    { status: 201 },
  );
});
