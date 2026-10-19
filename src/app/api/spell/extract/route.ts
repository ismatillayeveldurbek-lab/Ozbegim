import JSZip from "jszip";
import { decodeText, detectFile, FileRejectError } from "@/lib/files/detect";
import { extractPdfText } from "@/lib/files/formats/pdf";
import { extractXmlText } from "@/lib/files/ooxml-text";
import { clientIp, handle, HttpError, json } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/http";

const MAX = 5 * 1024 * 1024;

/** Fayldan matn olish (imlo tekshiruvi uchun). Fayl saqlanmaydi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(`extract:${clientIp(req)}`, 30, 600);
  if (Number(req.headers.get("content-length") ?? 0) > MAX + 64 * 1024) throw new HttpError(413, "Fayl juda katta (5 MB gacha).");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Fayl yuborilmadi.");
  if (file.size > MAX) throw new HttpError(413, "Fayl juda katta (5 MB gacha).");
  const buf = Buffer.from(await file.arrayBuffer());
  let format;
  try {
    format = detectFile(file.name, buf).format;
  } catch (e) {
    if (e instanceof FileRejectError) throw new HttpError(415, e.message, e.code);
    throw e;
  }
  let text = "";
  if (["txt", "csv", "srt", "vtt"].includes(format)) text = decodeText(buf).text;
  else if (format === "docx" || format === "pptx") {
    const zip = await JSZip.loadAsync(buf);
    const re = format === "docx" ? /^word\/document\.xml$/ : /^ppt\/slides\/slide\d+\.xml$/;
    const names = Object.keys(zip.files).filter((n) => re.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const n of names) text += extractXmlText(await zip.file(n)!.async("string"), format === "docx" ? "w:p" : "a:p", format === "docx" ? "w:t" : "a:t") + "\n";
  } else if (format === "pdf") {
    const r = await extractPdfText(buf).catch(() => null);
    if (!r) throw new HttpError(422, "PDF faylni o‘qib bo‘lmadi.");
    if (r.scanned) throw new HttpError(422, "PDF’da matn qatlami yo‘q (skanerlangan). OCR xizmati ulanmagan.");
    text = r.text;
  } else throw new HttpError(415, "Imlo tekshiruvi uchun bu formatdan matn olinmaydi.");
  if (text.length > 300_000) text = text.slice(0, 300_000);
  return json({ text: text.replace(/\n{3,}/g, "\n\n").trim(), format });
});
