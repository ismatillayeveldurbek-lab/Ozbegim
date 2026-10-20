#!/bin/sh
# Vercel build: migratsiyalar faqat production deployda (preview’lar prod bazani o‘zgartirmasin).
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  npx prisma migrate deploy
fi
npx next build
