import { prisma } from "@/lib/server/db";
import { handle, HttpError, requireUser } from "@/lib/server/http";
import { storage } from "@/lib/server/storage";

/** Yuklab olish faqat egasiga; havola ommaviy emas va keshlanmaydi. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const job = await prisma.fileJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id || !job.outputKey || job.expiresAt <= new Date()) throw new HttpError(404, "Fayl topilmadi.");
  const data = await storage().get(job.outputKey);
  const name = job.outputName ?? "natija";
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": job.outputMime ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
