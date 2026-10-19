import { z } from "zod";
import { buildDocx } from "@/lib/files/docx-builder";
import { outputName } from "@/lib/files/convert";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson, requireUser } from "@/lib/server/http";

/** PDF/rasmdan olingan va foydalanuvchi tekshirgan matnni TXT yoki DOCX qilib beradi. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const body = await readJson(req, z.object({ text: z.string().max(5_000_000), format: z.enum(["txt", "docx"]) }), 12_000_000);
  const job = await prisma.fileJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id || !job.textKey) throw new HttpError(404, "Fayl topilmadi.");
  const dir = job.direction === "cyr2lat" ? "cyr2lat" : "lat2cyr";
  const name = outputName(job.originalName, dir, body.format);
  const data = body.format === "docx" ? await buildDocx(body.text, job.originalName) : Buffer.from(body.text, "utf8");
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": body.format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, no-store",
    },
  });
});
