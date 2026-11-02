import { unreadCounts } from "@/lib/server/feedback";
import { handle, json } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/session";

/** O‘qilmagan javoblar soni (menyu belgisi uchun). Kirilmagan bo‘lsa — nol. */
export const GET = handle(async (req: Request) => {
  const user = await getCurrentUser(req.headers);
  return json(user ? await unreadCounts(user) : { mine: 0, staff: 0 });
});
