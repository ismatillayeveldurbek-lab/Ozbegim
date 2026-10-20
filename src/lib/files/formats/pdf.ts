/**
 * Matnli PDF’dan matn ajratish (pdfjs-dist). Asl joylashuv saqlanmaydi.
 */
export const MAX_PDF_PAGES = Number(process.env.PDF_MAX_PAGES ?? 300);

export interface PdfText {
  text: string;
  pages: number;
  scanned: boolean;
}

export async function extractPdfText(buf: Buffer): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node’da pdf.js "soxta ishchi"dan foydalanadi. Ishchini statik import qilamiz — aks holda
  // serverless paketlarga (Vercel, standalone) pdf.worker.mjs kirmay qoladi.
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
  });
  const doc = await task.promise;
  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      const err = new Error(`PDF juda katta: ${doc.numPages} sahifa (chegara — ${MAX_PDF_PAGES}).`);
      (err as Error & { code: string }).code = "PDF_PAGES";
      throw err;
    }
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let s = "";
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof item.str !== "string") continue;
        s += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(s.trim());
      page.cleanup();
    }
    const text = pages.join("\n\n");
    const letters = (text.match(/\p{L}/gu) ?? []).length;
    return { text, pages: doc.numPages, scanned: letters < 20 * doc.numPages };
  } finally {
    await task.destroy();
  }
}
