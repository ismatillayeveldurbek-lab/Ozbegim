import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

const intEnv = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// Prod’da kalit bo‘lishi, yetarlicha uzun bo‘lishi va ommaviy kodda ko‘rinadigan
// ishlab chiqish kaliti (dev-only-…) bo‘lmasligi shart.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const s = process.env.BETTER_AUTH_SECRET ?? "";
  if (s.length < 32 || (s.startsWith("dev-only-") && process.env.OZBEGIM_ALLOW_DEV_SECRET !== "1")) throw new Error("BETTER_AUTH_SECRET prod uchun yaroqsiz: kamida 32 belgili tasodifiy kalit bering (openssl rand -base64 32).");
}

export const auth = betterAuth({
  appName: "O‘zbegim",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // input: false — foydalanuvchi ro‘yxatdan o‘tishda bu maydonlarni o‘zi bera olmaydi.
      role: { type: "string", defaultValue: "user", input: false },
      banned: { type: "boolean", defaultValue: false, input: false },
      historyMode: { type: "string", defaultValue: "off", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT !== "off",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: intEnv("AUTH_SIGNIN_PER_MINUTE", 5) },
      "/sign-up/email": { window: 3600, max: intEnv("AUTH_SIGNUP_PER_HOUR", 5) },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production" && process.env.BETTER_AUTH_URL?.startsWith("https"),
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
  },
  plugins: [nextCookies()],
});
