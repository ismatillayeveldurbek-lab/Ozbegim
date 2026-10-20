#!/bin/sh
# Konteyner ishga tushishi: avval migratsiyalar, so‘ng veb-server.
# (Railway kabi platformalarda alohida pre-deploy bosqichiga ehtiyoj qolmaydi.)
set -e
# Render: BETTER_AUTH_URL berilmagan bo‘lsa, servisning tashqi manzilidan foydalanamiz
if [ -z "${BETTER_AUTH_URL:-}" ] && [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  export BETTER_AUTH_URL="$RENDER_EXTERNAL_URL"
fi
if [ "${SKIP_MIGRATIONS:-}" != "1" ]; then
  npx prisma migrate deploy
fi
# data/lugat dagi tasdiqlangan lug‘at (mavjud yozuvlarga tegilmaydi). O‘chirish: SEED_LUGAT=0
if [ "${SEED_LUGAT:-1}" != "0" ]; then
  npx tsx scripts/seed-lugat.ts || echo "SEED_LUGAT: lug‘at yuklanmadi"
fi
# Shell’siz platformalar (Render bepul reja): ADMIN_EMAIL berilsa, shu foydalanuvchiga admin roli beriladi
if [ -n "${ADMIN_EMAIL:-}" ]; then
  npx tsx scripts/grant-admin.ts "$ADMIN_EMAIL" || echo "ADMIN_EMAIL: admin roli berilmadi (foydalanuvchi ro‘yxatdan o‘tganmi?)"
fi
if [ -n "${STORAGE_LOCAL_DIR:-}" ]; then
  mkdir -p "$STORAGE_LOCAL_DIR"
fi
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
