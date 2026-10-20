# Railway’ga joylashtirish

Arxitektura: **bitta veb-servis** (Dockerfile) + **PostgreSQL** + **volume** (fayllar uchun).
Railway’da bitta volume faqat bitta servisga ulanadi, shuning uchun alohida fon ishchisi
o‘rniga `FILE_PROCESSING=inline` ishlatiladi: veb-jarayonning o‘zi fayl vazifalarini bajaradi
va muddati o‘tgan fayllarni har 10 daqiqada tozalaydi (`src/instrumentation.ts`).
Migratsiyalar konteyner ishga tushganda avtomatik bajariladi (`scripts/start-prod.sh`).

## Sinov rejasi cheklovlari (2026-10 holatiga)

- 30 kun, bir martalik $5 kredit; 1 GB RAM, umumiy vCPU.
- Volume 0,5 GB — fayllar 24 soatda o‘chiriladi, shuning uchun yetarli bo‘lishi kerak.
- Kredit tugagach yoki 30 kun o‘tgach hisob Free rejaga o‘tadi (oyiga $1 kredit); volume ma’lumotlari 30 kundan keyin o‘chiriladi. Bazani saqlash uchun pullik rejaga o‘tish yoki `pg_dump` bilan zaxira olish kerak.

## 1. Loyiha va servislar

1. railway.com → **New Project** → **Deploy from GitHub repo** → `ismatillayeveldurbek-lab/Ozbegim`.
   Railway `Dockerfile`ni avtomatik topadi.
2. Loyihada **+ New → Database → PostgreSQL**.
3. Veb-servis → **Settings → Volumes → Add Volume**, mount path: `/data`.

## 2. O‘zgaruvchilar (veb-servis → Variables)

| O‘zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` natijasi (32+ belgi, tasodifiy) |
| `BETTER_AUTH_URL` | `https://sizning-domeningiz.uz` |
| `TRUST_PROXY` | `true` |
| `FILE_PROCESSING` | `inline` |
| `STORAGE_DRIVER` | `local` |
| `STORAGE_LOCAL_DIR` | `/data/storage` |
| `FILE_RETENTION_HOURS` | `24` |
| `OCR_PROVIDER` | `tesseract` (obrazda Tesseract va poppler bor) |
| `RAILWAY_RUN_UID` | `0` (konteyner `node` foydalanuvchisi volume’ga yoza olishi uchun) |
| `ANTHROPIC_API_KEY` | ixtiyoriy — AI bo‘limlari uchun (pullik) |

`BETTER_AUTH_SECRET` qisqa yoki `dev-only-` bilan boshlansa, server prod rejimida ishlamaydi — bu ataylab qilingan.

## 3. Domen

Veb-servis → **Settings → Networking → Custom Domain** → domeningizni kiriting.
Railway ko‘rsatgan **CNAME** va **TXT** yozuvlarini domen DNS sozlamalariga qo‘shing (ikkalasi ham kerak).
SSL sertifikati avtomatik beriladi. Keyin `BETTER_AUTH_URL` ni shu manzilga to‘g‘rilang.

## 4. Birinchi administrator

Saytda ro‘yxatdan o‘ting, so‘ng Railway CLI orqali:

```bash
railway link            # loyihani tanlang
railway ssh -- npx tsx scripts/grant-admin.ts sizning@pochtangiz.uz
```

## 5. Tekshirish

- `https://domen/api/status` — `fileProcessing: "inline"`, `ocr.connected: true`.
- `https://domen/holat` — imkoniyatlar holati.
- Fayl yuklab ko‘ring: “Tayyor” holatiga o‘tishi kerak.
