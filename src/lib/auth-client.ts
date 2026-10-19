"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

const AUTH_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS: "Bu elektron pochta bilan hisob allaqachon mavjud.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu elektron pochta bilan hisob allaqachon mavjud.",
  INVALID_EMAIL_OR_PASSWORD: "Elektron pochta yoki parol noto‘g‘ri.",
  INVALID_EMAIL: "Elektron pochta manzili noto‘g‘ri.",
  PASSWORD_TOO_SHORT: "Parol kamida 8 belgidan iborat bo‘lsin.",
  PASSWORD_TOO_LONG: "Parol juda uzun.",
  TOO_MANY_REQUESTS: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.",
};

export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!err) return "Noma’lum xato.";
  if (err.code && AUTH_ERRORS[err.code]) return AUTH_ERRORS[err.code];
  if (err.status === 429) return AUTH_ERRORS.TOO_MANY_REQUESTS;
  return "Amalni bajarib bo‘lmadi. Ma’lumotlarni tekshirib, qayta urinib ko‘ring.";
}
