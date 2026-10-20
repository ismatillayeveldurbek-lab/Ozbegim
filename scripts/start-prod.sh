#!/bin/sh
# Konteyner ishga tushishi: avval migratsiyalar, so‘ng veb-server.
# (Railway kabi platformalarda alohida pre-deploy bosqichiga ehtiyoj qolmaydi.)
set -e
if [ "${SKIP_MIGRATIONS:-}" != "1" ]; then
  npx prisma migrate deploy
fi
if [ -n "${STORAGE_LOCAL_DIR:-}" ]; then
  mkdir -p "$STORAGE_LOCAL_DIR"
fi
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
