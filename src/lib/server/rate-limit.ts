import { prisma } from "./db";
import { HttpError } from "./http";

/**
 * Bazaga asoslangan fiks oynali rate limit (bir nechta server nusxasida ham ishlaydi).
 * Atomik INSERT ... ON CONFLICT bilan hisoblanadi.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; count: number }> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "AppRateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AppRateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE "AppRateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "AppRateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE "AppRateLimit"."windowStart" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 0);
  return { ok: count <= limit, count };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  if (process.env.APP_RATE_LIMIT === "off") return;
  const r = await hitRateLimit(key, limit, windowSeconds);
  if (!r.ok) throw new HttpError(429, "Juda ko‘p so‘rov yuborildi. Birozdan keyin qayta urinib ko‘ring.", "RATE_LIMITED");
}
