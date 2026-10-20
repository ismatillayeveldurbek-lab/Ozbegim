/**
 * data/lugat/*.csv dagi tasdiqlangan lug‘at yozuvlarini bazaga yuklaydi (mashqlar shu yozuvlardan tuziladi).
 * Bazada bor yozuvlarga tegilmaydi (skip), shuning uchun har ishga tushishda xavfsiz takrorlanadi:
 *   npx tsx scripts/seed-lugat.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/server/db";
import { commit, FIELDS, type ImportTarget, parseImportFile, prepare } from "../src/lib/server/importer";

const FILES: Array<[string, ImportTarget]> = [
  ["iboralar.csv", "idiom"],
  ["ozlashma.csv", "loanword"],
  ["imlo.csv", "spelling"],
];

async function main() {
  for (const [file, target] of FILES) {
    const full = path.join(__dirname, "..", "data", "lugat", file);
    const [sheet] = await parseImportFile(file, readFileSync(full));
    const mapping = Object.fromEntries(FIELDS[target].map((f) => [f.key, sheet.headers.indexOf(f.key)]).filter(([, i]) => (i as number) >= 0));
    const prep = await prepare(target, sheet, mapping, "VERIFIED");
    if (prep.errors.length) console.warn(`${file}: ${prep.errors.length} ta qator xato, o‘tkazib yuborildi`);
    const r = await commit(target, prep, "skip", null, `seed:${file}`);
    console.log(`${file}: ${r.created} ta qo‘shildi, ${r.skipped} ta bor edi`);
  }
}

main()
  .catch((e) => {
    console.error("Lug‘at yuklanmadi:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
