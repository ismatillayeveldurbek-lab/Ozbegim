import "dotenv/config";
import pg from "pg";

/** Har bir test yugurishidan oldin ilova rate-limit hisoblagichlari tozalanadi (oldingi yugurishlar ta’sir qilmasin). */
export default async function setup() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DELETE FROM "AppRateLimit"');
  await c.query('DELETE FROM "rateLimit"');
  await c.end();
}
