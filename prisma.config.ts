import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migratsiyalar uchun pooler’siz (to‘g‘ridan-to‘g‘ri) ulanish afzal: Neon’da DATABASE_URL_UNPOOLED.
  datasource: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL") },
});
