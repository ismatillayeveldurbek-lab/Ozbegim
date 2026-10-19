/**
 * ZIP arxivini OCHMASDAN tekshirish: markaziy katalogni o‘qib, fayllar soni, ochilgandagi
 * umumiy hajm, siqish nisbati (ZIP bomb) va xavfli yo‘llarni aniqlaydi.
 */

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ZipLimits {
  maxEntries: number;
  maxTotalUncompressed: number;
  maxEntryUncompressed: number;
  maxRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 3000,
  maxTotalUncompressed: 250 * 1024 * 1024,
  maxEntryUncompressed: 100 * 1024 * 1024,
  maxRatio: 200,
};

export class ZipCheckError extends Error {
  constructor(
    public code: "ZIP_CORRUPT" | "ZIP_TOO_MANY" | "ZIP_BOMB" | "ZIP_PATH" | "ZIP_ENCRYPTED",
    message: string,
  ) {
    super(message);
  }
}

export function listZipEntries(buf: Buffer): ZipEntryInfo[] {
  // End of central directory (EOCD) yozuvini oxiridan qidiramiz.
  const min = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipCheckError("ZIP_CORRUPT", "Fayl buzilgan: arxiv tuzilmasi topilmadi.");
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipCheckError("ZIP_CORRUPT", "ZIP64 arxivlari qo‘llab-quvvatlanmaydi.");
  if (cdOffset + cdSize > buf.length) throw new ZipCheckError("ZIP_CORRUPT", "Fayl buzilgan yoki to‘liq yuklanmagan.");

  const entries: ZipEntryInfo[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new ZipCheckError("ZIP_CORRUPT", "Fayl buzilgan: arxiv katalogi noto‘g‘ri.");
    const flags = buf.readUInt16LE(p + 8);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (flags & 0x1) throw new ZipCheckError("ZIP_ENCRYPTED", "Parol bilan himoyalangan fayllar qo‘llab-quvvatlanmaydi.");
    entries.push({ name, compressedSize, uncompressedSize });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function isUnsafePath(name: string): boolean {
  return (
    name.startsWith("/") ||
    name.startsWith("\\") ||
    /^[a-zA-Z]:/.test(name) ||
    name.includes("\\") ||
    name.split("/").some((seg) => seg === "..") ||
    name.includes("\0")
  );
}

export function inspectZip(buf: Buffer, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipEntryInfo[] {
  const entries = listZipEntries(buf);
  if (entries.length > limits.maxEntries) throw new ZipCheckError("ZIP_TOO_MANY", `Arxivda juda ko‘p fayl bor (${entries.length}).`);
  let total = 0;
  for (const e of entries) {
    if (isUnsafePath(e.name)) throw new ZipCheckError("ZIP_PATH", "Arxivda xavfli fayl yo‘li aniqlandi.");
    total += e.uncompressedSize;
    if (e.uncompressedSize > limits.maxEntryUncompressed) throw new ZipCheckError("ZIP_BOMB", "Arxiv ichidagi fayl ochilganda juda katta bo‘ladi.");
    if (e.compressedSize > 0 && e.uncompressedSize / e.compressedSize > limits.maxRatio && e.uncompressedSize > 1024 * 1024)
      throw new ZipCheckError("ZIP_BOMB", "Arxiv shubhali darajada kuchli siqilgan (ZIP bomb ehtimoli).");
  }
  if (total > limits.maxTotalUncompressed) throw new ZipCheckError("ZIP_BOMB", "Arxiv ochilganda umumiy hajmi chegaradan oshadi.");
  return entries;
}
