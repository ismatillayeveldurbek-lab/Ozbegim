#!/bin/bash
# Claude Code bulut sessiyasi uchun muhitni tayyorlash: bog‘liqliklar, PostgreSQL, migratsiyalar.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 1. npm bog‘liqliklari (postinstall Prisma klientini yaratadi)
npm install --no-audit --no-fund

# 2. PostgreSQL (konteynerda o‘rnatilgan bo‘lsa)
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -q || service postgresql start >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pg_isready -q && break; sleep 1; done
  if pg_isready -q; then
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='ozbegim'\"" | grep -q 1 \
      || su postgres -c "psql -q -c \"CREATE USER ozbegim WITH PASSWORD 'ozbegim_dev' CREATEDB;\""
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='ozbegim'\"" | grep -q 1 \
      || su postgres -c "psql -q -c 'CREATE DATABASE ozbegim OWNER ozbegim;'"
  fi
fi

# 3. Faqat ishlab chiqish uchun .env (mavjud bo‘lsa tegilmaydi; haqiqiy kalitlar emas)
if [ ! -f .env ]; then
  cat > .env <<'ENV'
DATABASE_URL="postgresql://ozbegim:ozbegim_dev@localhost:5432/ozbegim?schema=public"
BETTER_AUTH_SECRET="dev-only-secret-change-me-0123456789abcdef"
BETTER_AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR="./.data/storage"
FILE_RETENTION_HOURS="24"
ENV
fi

# 4. Migratsiyalar
if command -v pg_isready >/dev/null 2>&1 && pg_isready -q; then
  npx prisma migrate deploy
fi
