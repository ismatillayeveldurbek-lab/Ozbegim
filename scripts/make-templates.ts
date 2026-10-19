/** templates/ papkasidagi import shablonlarini qayta yaratish: npx tsx scripts/make-templates.ts */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { templateCsv, templateXlsx } from "../src/lib/server/templates";

(async () => {
  for (const t of ["idiom", "loanword", "lexeme", "spelling"] as const) {
    writeFileSync(`templates/${t}.csv`, templateCsv(t));
    writeFileSync(`templates/${t}.xlsx`, await templateXlsx(t));
  }
  console.log("Shablonlar templates/ papkasiga yozildi.");
})();
