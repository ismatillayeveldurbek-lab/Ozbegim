# Render’ga joylashtirish

Arxitektura: **bitta veb-servis** (Dockerfile, Tesseract OCR bilan) + **Render PostgreSQL**.
Hammasi `render.yaml` (Blueprint) da tasvirlangan. Bepul rejada disk yo‘q, shuning uchun
fayllar bazada saqlanadi (`STORAGE_DRIVER=db`), ishlov va tozalash veb-jarayonning o‘zida
(`FILE_PROCESSING=inline`, `src/instrumentation.ts` — har 10 daqiqada).
Migratsiyalar konteyner ishga tushganda bajariladi (`scripts/start-prod.sh`).

## Bepul reja cheklovlari (2026-10 holatiga)

- Veb-servis: 512 MB RAM, 0,1 CPU; 15 daqiqa so‘rov bo‘lmasa uxlaydi, birinchi so‘rov ~1 daqiqa kutadi.
- PostgreSQL: 1 GB, **30 kundan keyin muddati tugaydi** (14 kun ichida pullik rejaga o‘tmasa o‘chiriladi).
  Uzoq muddat uchun bazani pullik rejaga o‘tkazing yoki tashqi baza (masalan, Neon) `DATABASE_URL` ini bering.

## 1. Deploy

1. Ushbu havolani oching (Render hisobiga GitHub orqali kiring):
   **https://render.com/deploy?repo=https://github.com/ismatillayeveldurbek-lab/Ozbegim**
   (yoki dashboard → **New → Blueprint** → reponi tanlang).
2. Render `render.yaml` ni o‘qiydi: `ozbegim` veb-servisi va `ozbegim-db` bazasi yaratiladi.
   `BETTER_AUTH_SECRET` avtomatik generatsiya qilinadi, `DATABASE_URL` bazadan ulanadi.
3. `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` so‘ralsa — ixtiyoriy (AI bo‘limlari uchun), bo‘sh qoldirish mumkin.
   Bepul kalit: https://aistudio.google.com → **Get API key** → `GEMINI_API_KEY` ga yozing.
   Zaxira (bepul): https://console.groq.com → **API Keys** → `LLM_API_KEY`. Gemini limiti tugasa avtomatik Groq ishlatiladi.
4. **Apply** → birinchi build ~10 daqiqa davom etadi.

Sayt manzili: `https://ozbegim-xxxx.onrender.com`. `BETTER_AUTH_URL` berilmagan bo‘lsa shu manzil
avtomatik ishlatiladi (`RENDER_EXTERNAL_URL`).

## 2. Domen

Servis → **Settings → Custom Domains → Add** → Render ko‘rsatgan CNAME/A yozuvini DNS’ga qo‘shing.
So‘ng **Environment** bo‘limida `BETTER_AUTH_URL=https://sizning-domeningiz.uz` qo‘shib, qayta deploy qiling.

## 3. Birinchi administrator

Saytda ro‘yxatdan o‘ting, so‘ng servis → **Environment** → `ADMIN_EMAIL=sizning@pochtangiz.uz`
qo‘shing va saqlang (**Save, rebuild, and deploy**). Server ishga tushganda shu foydalanuvchiga
admin roli beriladi (`scripts/start-prod.sh`). Rol bazada saqlanadi, keyin `ADMIN_EMAIL` ni o‘chirsa bo‘ladi.

Muqobil: lokal kompyuterdan bazaning **External Database URL** i bilan
`DATABASE_URL="<URL>" npx tsx scripts/grant-admin.ts sizning@pochtangiz.uz`.

## 4. Tekshirish

- `https://<manzil>/api/status` — `fileProcessing: "inline"`, `ocr.connected: true`.
- Fayl yuklab ko‘ring: “Tayyor” holatiga o‘tishi kerak.
