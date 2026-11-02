import { checkProviders } from "@/lib/server/ai";
import { assertSameOrigin, handle, json, requireAdmin } from "@/lib/server/http";

/** Ulangan tashqi xizmatlarni tekshirish (faqat admin). Har biriga bitta kichik so‘rov ketadi. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const admin = await requireAdmin(req);
  return json({ results: await checkProviders(admin.id) });
});
