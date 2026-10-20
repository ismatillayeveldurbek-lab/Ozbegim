import { z } from "zod";
import { detectFile, FileRejectError } from "@/lib/files/detect";
import { prisma } from "@/lib/server/db";
import { createJobWithInput, expiry, MAX_FILE_MB, serializeJob } from "@/lib/server/file-jobs";
import { scheduleInlineProcessing } from "@/lib/server/inline-after";
import { handle, HttpError, json, requireUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { recordHistory } from "@/lib/server/history";

const optionsSchema = z.object({
  direction: z.enum(["auto", "lat2cyr", "cyr2lat"]).default("auto"),
  apostrophe: z.enum(["typographic", "unicode", "ascii"]).default("typographic"),
  protect: z
    .object({ urls: z.boolean(), emails: z.boolean(), code: z.boolean(), formulas: z.boolean(), markers: z.boolean() })
    .partial()
    .default({}),
});

/** Foydalanuvchining fayl vazifalari (faqat o‘ziniki). */
/** Inline rejimda fayl javobdan keyin shu funksiyada ishlanadi (Vercel Hobby: 300 s gacha). */
export const maxDuration = 300;

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const jobs = await prisma.fileJob.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 100 });
  return json({ items: jobs.map(serializeJob), retentionHours: Number(process.env.FILE_RETENTION_HOURS ?? 24) });
});

/** Fayl yuklash: tur va hajm tekshiriladi, asl nusxa yopiq saqlashga qo‘yiladi, vazifa navbatga tushadi. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const maxBytes = MAX_FILE_MB * 1024 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes + 64 * 1024) throw new HttpError(413, `Fayl juda katta. Chegara — ${MAX_FILE_MB} MB.`, "TOO_LARGE");
  await enforceRateLimit(`upload:${user.id}`, 60, 3600);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Fayl yuborilmadi.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Fayl yuborilmadi.");
  if (file.size > maxBytes) throw new HttpError(413, `Fayl juda katta. Chegara — ${MAX_FILE_MB} MB.`, "TOO_LARGE");
  const name = file.name.slice(0, 200) || "fayl";
  const options = optionsSchema.parse(JSON.parse(String(form.get("options") ?? "{}")));
  const buf = Buffer.from(await file.arrayBuffer());

  let format;
  try {
    format = detectFile(name, buf).format;
  } catch (e) {
    if (e instanceof FileRejectError) throw new HttpError(415, e.message, e.code);
    throw e;
  }

  const expiresAt = expiry();
  // Avval fayl saqlanadi, so‘ng vazifa tayyor kalit bilan yaratiladi: navbatda hech qachon
  // fayli hali yozilmagan vazifa ko‘rinmaydi (parallel ishchi uni olib qo‘yolmaydi).
  const saved = await createJobWithInput(user.id, buf, {
    originalName: name,
    format,
    sizeBytes: buf.length,
    direction: options.direction,
    options,
    expiresAt,
  });
  await recordHistory(user, { type: "file", summary: `Fayl yuklandi: ${name}`, meta: { format, sizeBytes: buf.length, jobId: saved.id } });

  scheduleInlineProcessing();
  return json(serializeJob(saved), { status: 201 });
});
