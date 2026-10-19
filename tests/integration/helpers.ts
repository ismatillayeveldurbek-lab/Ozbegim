import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

/** Cookie’larni saqlaydigan oddiy HTTP mijoz (brauzer o‘rnida). */
export class Client {
  cookies = new Map<string, string>();

  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    headers.set("origin", BASE);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const res = await fetch(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (/max-age=0/i.test(c) || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async json<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ status: number; body: T }> {
    const res = await this.req(path, init);
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }

  async signUp(name = "Sinov") {
    const email = `test-${randomUUID().slice(0, 8)}@sinov.uz`;
    const r = await this.json("/api/auth/sign-up/email", { method: "POST", json: { name, email, password: "parol-12345" } });
    if (r.status !== 200) throw new Error(`Ro‘yxatdan o‘tish xatosi: ${r.status} ${JSON.stringify(r.body)}`);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { email, id: user.id };
  }
}

export async function makeAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
}

export { prisma };
