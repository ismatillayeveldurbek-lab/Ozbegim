/**
 * Namuna ma’lumotlarni yuklash: npm run db:seed:demo
 * Namunalarni o‘chirish:     npm run db:seed:demo -- --remove
 * Barcha yozuvlar origin = DEMO bilan saqlanadi va "Namuna (tasdiqlanmagan)" deb ko‘rsatiladi.
 */
import "dotenv/config";
import { prisma } from "../src/lib/server/db";
import { normalizeKey } from "../src/lib/uz/normalize";
import { DEMO_IDIOMS, DEMO_LEXEMES, DEMO_LOANWORDS, DEMO_SPELLING } from "../data/demo/demo-data";

async function remove() {
  const r = await prisma.$transaction([
    prisma.idiom.deleteMany({ where: { origin: "DEMO" } }),
    prisma.loanword.deleteMany({ where: { origin: "DEMO" } }),
    prisma.lexeme.deleteMany({ where: { origin: "DEMO" } }),
    prisma.spellingPair.deleteMany({ where: { origin: "DEMO" } }),
  ]);
  console.log(`Namunalar o‘chirildi: ${r.map((x) => x.count).join(", ")}`);
}

async function seed() {
  let created = 0;
  let skipped = 0;
  for (const i of DEMO_IDIOMS) {
    const key = normalizeKey(i.phrase);
    if (await prisma.idiom.findUnique({ where: { key } })) {
      skipped++;
      continue;
    }
    await prisma.idiom.create({
      data: {
        phrase: i.phrase,
        key,
        tags: i.tags,
        origin: "DEMO",
        status: "PENDING",
        senses: { create: i.senses.map((s, n) => ({ order: n, meaning: s.meaning, example: s.example, synonyms: s.synonyms ?? [] })) },
      },
    });
    created++;
  }
  for (const l of DEMO_LOANWORDS) {
    const key = normalizeKey(l.word);
    if (await prisma.loanword.findUnique({ where: { key } })) {
      skipped++;
      continue;
    }
    const variantKeys = [...new Set((l.spellingVariants ?? []).map(normalizeKey))].filter((k) => k && k !== key);
    const taken = await prisma.loanwordKey.findMany({ where: { key: { in: variantKeys } } });
    await prisma.loanword.create({
      data: {
        word: l.word,
        key,
        meaning: l.meaning,
        domain: l.domain,
        originLanguage: l.originLanguage,
        spellingVariants: l.spellingVariants ?? [],
        origin: "DEMO",
        status: "PENDING",
        alternatives: { create: l.alternatives.map((a, n) => ({ text: a.text, usageNote: a.usageNote, order: n })) },
        examples: { create: (l.examples ?? []).map((t, n) => ({ text: t, order: n })) },
        variantKeys: { create: variantKeys.filter((k) => !taken.some((t) => t.key === k)).map((k) => ({ key: k })) },
      },
    });
    created++;
  }
  for (const s of DEMO_SPELLING) {
    const wrongKey = normalizeKey(s.wrong);
    await prisma.spellingPair.upsert({
      where: { wrongKey },
      create: { wrong: s.wrong, wrongKey, correct: s.correct, note: s.note, origin: "DEMO", status: "PENDING" },
      update: {},
    });
  }
  for (const x of DEMO_LEXEMES) {
    const key = normalizeKey(x.lemma);
    await prisma.lexeme.upsert({
      where: { key_pos: { key, pos: x.pos } },
      create: { lemma: x.lemma, key, pos: x.pos, meaning: x.meaning, examples: x.examples ?? [], origin: "DEMO", status: "PENDING" },
      update: {},
    });
  }
  console.log(`Namuna ma’lumotlar yuklandi: ${created} ta yangi, ${skipped} ta mavjud (o‘tkazib yuborildi).`);
}

(process.argv.includes("--remove") ? remove() : seed())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
