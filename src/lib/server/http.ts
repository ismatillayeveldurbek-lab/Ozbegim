import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isAdmin, isStaff, type CurrentUser } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".");
    return NextResponse.json(
      { error: `Ma’lumot noto‘g‘ri${field ? ` (${field})` : ""}: ${first?.message ?? ""}`.trim(), code: "VALIDATION" },
      { status: 400 },
    );
  }
  // Shaxsiy matnlar loglarga yozilmaydi — faqat xato turi va xabari.
  console.error("[api] kutilmagan xato:", err instanceof Error ? `${err.name}: ${err.message}` : "noma’lum");
  return NextResponse.json({ error: "Serverda kutilmagan xato yuz berdi. Keyinroq qayta urinib ko‘ring." }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Xatolarni o‘zbekcha javobga aylantiradi. */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * CSRF himoyasi: holatni o‘zgartiruvchi so‘rovlarda Origin (yoki Referer) sayt manziliga mos bo‘lishi shart.
 * Sessiya cookie’si SameSite=Lax — bu qo‘shimcha himoya qatlami.
 */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  if (!origin) throw new HttpError(403, "So‘rov manbasi aniqlanmadi (CSRF himoyasi).", "CSRF");
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  if (process.env.BETTER_AUTH_URL) allowed.add(new URL(process.env.BETTER_AUTH_URL).origin);
  for (const o of (process.env.TRUSTED_ORIGINS ?? "").split(",")) if (o.trim()) allowed.add(o.trim());
  if (!allowed.has(origin)) throw new HttpError(403, "Boshqa saytdan yuborilgan so‘rov rad etildi (CSRF himoyasi).", "CSRF");
}

export async function requireUser(req: Request): Promise<CurrentUser> {
  assertSameOrigin(req);
  const user = await getCurrentUser(req.headers);
  if (!user) throw new HttpError(401, "Bu amal uchun tizimga kiring.", "UNAUTHORIZED");
  if (user.banned) throw new HttpError(403, "Hisobingiz cheklangan.", "BANNED");
  return user;
}

export async function requireStaff(req: Request): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (!isStaff(user)) throw new HttpError(403, "Bu bo‘lim faqat moderator va administratorlar uchun.", "FORBIDDEN");
  return user;
}

export async function requireAdmin(req: Request): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (!isAdmin(user)) throw new HttpError(403, "Bu bo‘lim faqat administratorlar uchun.", "FORBIDDEN");
  return user;
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = 1_000_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "So‘rov hajmi juda katta.", "TOO_LARGE");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "So‘rov hajmi juda katta.", "TOO_LARGE");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "So‘rov JSON formatida emas.", "BAD_JSON");
  }
  return schema.parse(body);
}

export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") ?? "local";
}
