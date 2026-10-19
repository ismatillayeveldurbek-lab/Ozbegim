# O‘ZBEGIM — veb-ilova va fon ishchisi uchun umumiy obraz
FROM node:22-bookworm-slim AS base
WORKDIR /app
# OCR uchun bepul, lokal Tesseract (o‘zbek lotin va kirill til paketlari bilan)
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-uzb tesseract-ocr-uzb-cyrl poppler-utils ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma generate uchun vaqtinchalik qiymat (build paytida bazaga ulanilmaydi)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /app/.data/storage && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["npm", "start"]
