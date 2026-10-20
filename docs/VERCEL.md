# Vercel’ga joylashtirish (bepul Hobby reja)

Arxitektura: Next.js → **Vercel Functions**, baza → **Neon PostgreSQL** (Vercel Marketplace, bepul),
fayllar → **bazaning o‘zida** (`STORAGE_DRIVER=db`), fayl ishlovi → javobdan keyin shu funksiyada
(`FILE_PROCESSING=inline`, Next.js `after()`), tozalash → kunlik **Vercel Cron** + har yuklashda.

## Bepul reja cheklovlari va ularning saytga ta’siri (2026-10 holatiga)

| Cheklov | Ta’siri |
|---|---|
| **Faqat shaxsiy, notijorat foydalanish** | Sayt reklama, to‘lov yoki biznes uchun ishlatilsa — Pro reja ($20/oy) kerak |
| So‘rov/javob hajmi 4,5 MB | Fayl chegarasi 4 MB (`FILE_MAX_MB=4`, `MAX_RESPONSE_MB=4`) |
| Funksiya 300 soniyagacha, 2 GB RAM | Katta fayllar shu vaqtga sig‘ishi kerak |
| Cron kuniga 1 marta | Muddati o‘tgan fayllar kunlik cron va yangi yuklashlarda tozalanadi |
| Docker / tizim dasturlari yo‘q | OCR (Tesseract) ishlamaydi — interfeys “Xizmat ulanmagan” deydi |
| Oyiga 4 CPU-soat, 1 mln chaqiruv | Kichik va o‘rta trafik uchun yetarli; oshsa 30 kun to‘xtaydi |
| Neon: 0,5 GB baza, 100 CU-soat | Fayllar 24 soatda o‘chiriladi, shuning uchun bazada joy yetadi |

## 1. Loyihani ulash

1. vercel.com → **Add New → Project** → GitHub’dan `ismatillayeveldurbek-lab/Ozbegim` ni tanlang (Import).
2. Framework: Next.js (avtomatik). Build va Install buyruqlariga tegmang — `vercel.json` da belgilangan.
3. Hozircha **Deploy** bosmang — avval baza va o‘zgaruvchilarni qo‘shing (yoki birinchi deploy xato bersa, keyin **Redeploy**).

## 2. Baza (Neon)

Loyiha → **Storage → Create Database → Neon (Postgres)** → bepul reja → loyihaga ulang.
Integratsiya `DATABASE_URL` (pooled) va `DATABASE_URL_UNPOOLED` (direct) ni o‘zi qo‘shadi.
Migratsiyalar production deployda avtomatik bajariladi (`scripts/vercel-build.sh`, direct ulanish orqali).

## 3. O‘zgaruvchilar (Settings → Environment Variables, Production)

| O‘zgaruvchi | Qiymat |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` natijasi (32+ belgi, tasodifiy) |
| `BETTER_AUTH_URL` | `https://sizning-domeningiz.uz` (domen ulanguncha `https://<loyiha>.vercel.app`) |
| `TRUST_PROXY` | `true` |
| `STORAGE_DRIVER` | `db` |
| `FILE_PROCESSING` | `inline` |
| `FILE_MAX_MB` | `4` |
| `MAX_RESPONSE_MB` | `4` |
| `FILE_RETENTION_HOURS` | `24` |
| `CRON_SECRET` | `openssl rand -hex 24` natijasi (Vercel Cron uni avtomatik yuboradi) |
| `ANTHROPIC_API_KEY` | ixtiyoriy — AI bo‘limlari uchun (pullik) |

`OCR_PROVIDER` ni bermang (Vercel’da Tesseract yo‘q). `OZBEGIM_ALLOW_DEV_SECRET` ni **hech qachon** bermang.

## 4. Domen

Loyiha → **Settings → Domains → Add** → domeningizni kiriting. Vercel ko‘rsatgan yozuvni
domen DNS paneliga qo‘shing:

- asosiy domen (`ozbegim.uz`) — **A** yozuv (odatda `76.76.21.21`);
- subdomen (`www.ozbegim.uz`) — **CNAME** (Vercel ko‘rsatgan qiymat).

Aniq qiymatni Vercel panelidagi yozuvdan oling. SSL avtomatik beriladi; DNS 24 soatgacha tarqalishi mumkin.
So‘ng `BETTER_AUTH_URL` ni domenga o‘zgartirib, **Redeploy** qiling.

## 5. Birinchi administrator

Saytda ro‘yxatdan o‘ting, so‘ng o‘z kompyuteringizda (loyiha papkasida):

```bash
# DATABASE_URL_UNPOOLED qiymatini Vercel → Storage → Neon sahifasidan oling
DATABASE_URL="<Neon ulanish manzili>" npm run admin:grant -- sizning@pochtangiz.uz
```

Yoki Neon Console → SQL Editor’da:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'sizning@pochtangiz.uz';
```

## 6. Tekshirish

- `https://domen/api/status` — `storage.driver: "db"`, `fileProcessing: "inline"`, `maxFileMb: 4`.
- Fayl yuklang (≤ 4 MB) — bir necha soniyada “Tayyor” bo‘lishi kerak.
- Vercel → **Settings → Cron Jobs** — `/api/cron/cleanup` kunlik ro‘yxatda bo‘lishi kerak.

## Preview deploylar

Migratsiyalar faqat production’da bajariladi — preview deploy prod bazani o‘zgartirmasligi uchun.
Neon integratsiyasida “preview branch” yoqilgan bo‘lsa, preview’lar alohida baza nusxasini oladi;
ularda migratsiya kerak bo‘lsa, `DATABASE_URL_UNPOOLED` bilan `npx prisma migrate deploy` ni qo‘lda bajaring.

## Diagnostika

`DEBUG_JOBS=1` — fayl vazifalaridagi kutilmagan xatolarning to‘liq matnini Vercel Runtime Logs’ga chiqaradi
(fayl mazmuni loglanmaydi). Muammo hal bo‘lgach o‘chiring.
