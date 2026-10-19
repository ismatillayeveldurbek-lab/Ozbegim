import { searchIdioms, serializeIdiom } from "@/lib/server/dictionary";
import { clientIp, handle, HttpError, json } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  if (!q.trim()) throw new HttpError(400, "Qidiruv so‘zini kiriting.");
  await enforceRateLimit(`search:${clientIp(req)}`, 120, 60);
  const r = await searchIdioms(q, { record: url.searchParams.get("record") === "1" });
  return json({ key: r.key, exact: r.exact.map(serializeIdiom), near: r.near.map(serializeIdiom) });
});
