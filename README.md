# O‘ZBEGIM — O‘zbek tili yordamchisi

Lotin ↔ kirill konvertori (matn va fayllar), iboralar ma’nosi, imlo tekshiruvi, o‘zlashma so‘zlarning o‘zbekcha muqobillari, so‘z va gap tahlili, shaxsiy lug‘at, mashqlar va admin paneli bo‘lgan veb-ilova.

- **Texnologiyalar:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 16 + Prisma 7 · Better Auth · JSZip/ExcelJS/pdf.js · Vitest + Playwright
- **Interfeys:** to‘liq o‘zbek tilida, yorug‘/qorong‘i mavzu, telefon va kompyuterga moslashgan glassmorphism dizayn.

## Mundarija

1. [Tez boshlash (mahalliy)](#tez-boshlash-mahalliy)
2. [Muhit o‘zgaruvchilari](#muhit-ozgaruvchilari)
3. [Dastlabki administratorni sozlash](#dastlabki-administratorni-sozlash)
4. [Fon ishchisi va fayllarni tozalash](#fon-ishchisi-va-fayllarni-tozalash)
5. [Lug‘atni import qilish](#lugatni-import-qilish)
6. [Testlar](#testlar)
7. [Joylashtirish (deploy)](#joylashtirish-deploy)
8. [Imkoniyatlar holati](#imkoniyatlar-holati)
9. [Loyiha tuzilishi](#loyiha-tuzilishi)
10. [Xavfsizlik va maxfiylik](#xavfsizlik-va-maxfiylik)

## Tez boshlash (mahalliy)

Talablar: Node.js 22+, PostgreSQL 14+ (pg_trgm kengaytmasi bilan — odatiy PostgreSQL paketida bor).

```bash
# 1. Bog‘liqliklar (postinstall Prisma klientini yaratadi)
npm install

# 2. Baza
createdb ozbegim                       # yoki mavjud bazadan foydalaning
cp .env.example .env                   # DATABASE_URL va BETTER_AUTH_SECRET ni to‘ldiring
#   BETTER_AUTH_SECRET uchun: openssl rand -base64 32

# 3. Migratsiyalar
npm run db:migrate

# 4. (ixtiyoriy) Namuna ma’lumotlar — "Namuna (tasdiqlanmagan)" deb belgilanadi
npm run db:seed:demo
#   Namunalarni o‘chirish: npm run db:seed:demo -- --remove

# 5. Ishga tushirish (ikki terminalda)
npm run dev        # http://localhost:3000
npm run worker     # fayl vazifalari va tozalash
```

Ishchini alohida ishga tushirmaslik uchun `.env` da `FILE_PROCESSING="inline"` qo‘yish mumkin — fayl shu veb-jarayonda ishlanadi (kichik o‘rnatmalar uchun).

## Muhit o‘zgaruvchilari

Barcha sozlamalar qiymatlarsiz `.env.example` faylida izohlari bilan berilgan. Asosiylari:

| O‘zgaruvchi | Vazifasi |
|---|---|
| `DATABASE_URL` | PostgreSQL ulanishi |
| `BETTER_AUTH_SECRET` | Sessiya imzosi uchun maxfiy kalit (kamida 32 belgi) |
| `BETTER_AUTH_URL` | Saytning to‘liq manzili; CSRF/Origin tekshiruvi uchun ham |
| `TRUST_PROXY` | Reverse proxy ortida `true` — IP `X-Forwarded-For` dan olinadi |
| `STORAGE_DRIVER` | `local` (public/ dan tashqaridagi yopiq papka) yoki `s3` |
| `FILE_RETENTION_HOURS`, `FILE_MAX_MB` | Fayl saqlash muddati va hajm chegarasi |
| `FILE_PROCESSING` | `worker` (tavsiya) yoki `inline` |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Ixtiyoriy AI tavsiyalari (bo‘sh bo‘lsa — “Xizmat ulanmagan”) |
| `OCR_PROVIDER` | `tesseract` — serverda o‘rnatilgan Tesseract bilan rasmdan matn ajratish |
| `EXERCISES_ALLOW_DEMO` | `true` — mashqlarda namuna ma’lumotlardan foydalanish (savollar alohida belgilanadi) |

Maxfiy qiymatlar faqat serverda o‘qiladi; frontendga, loglarga yoki Git’ga chiqmaydi (`.env` `.gitignore` da).

## Dastlabki administratorni sozlash

Ro‘yxatdan o‘tgan birinchi foydalanuvchi ham **avtomatik admin bo‘lmaydi**, ro‘yxatdan o‘tish formasi orqali rol berib bo‘lmaydi (`role` maydoni `input: false`). Admin faqat serverga kirish huquqi bor operator tomonidan tayinlanadi:

```bash
# 1. Saytda oddiy tartibda ro‘yxatdan o‘ting
# 2. Serverda:
npm run admin:grant -- sizning@pochtangiz.uz             # admin
npm run admin:grant -- moderator@pochta.uz --role=moderator
```

Har bir tayinlash audit jurnaliga yoziladi. Keyinchalik admin boshqa foydalanuvchilar rolini “Admin paneli → Foydalanuvchilar” bo‘limida o‘zgartira oladi (o‘zinikini emas). Admin huquqi har bir API so‘rovida serverda, bazadan o‘qilgan rol bo‘yicha tekshiriladi.

Rollar: `user` (oddiy), `moderator` (izohlar va shikoyatlar), `admin` (hammasi: lug‘at, import/eksport, foydalanuvchilar, audit).

## Fon ishchisi va fayllarni tozalash

- `npm run worker` — navbatdagi fayl vazifalarini oladi (`FOR UPDATE SKIP LOCKED`, bir nechta ishchi parallel ishlashi mumkin), qotib qolgan vazifalarni qayta navbatga qo‘yadi va har 10 daqiqada muddati o‘tgan fayllarni o‘chiradi.
- `npm run cleanup` — bir martalik tozalash (cron uchun). Masalan, har soatda:
  ```cron
  0 * * * * cd /srv/ozbegim && npm run cleanup >> /var/log/ozbegim-cleanup.log 2>&1
  ```
- Fayllar `FILE_RETENTION_HOURS` (standart 24 soat) o‘tgach o‘chiriladi; foydalanuvchi o‘z faylini istalgan vaqtda o‘chira oladi. Muddat interfeysda ko‘rsatiladi.

## Lug‘atni import qilish

Admin paneli → **Import**: fayl yuklash → varaq tanlash → ustunlarni maydonlarga moslashtirish → oldindan ko‘rish → xatolar satr raqami bilan → takroriy yozuvlar → “o‘tkazib yuborish” yoki “yangilash” qoidasi → tasdiqlash → hisobot. Import **bitta tranzaksiyada** bajariladi: biror yozuvda xato chiqsa, bazaga hech narsa yozilmaydi.

Namuna shablonlar: [`templates/`](templates/) (`idiom`, `loanword`, `lexeme`, `spelling` — CSV va XLSX; XLSX ichida “Yo‘riqnoma” varag‘i bor). Shablonlarni qayta yaratish: `npm run templates`.

| Shablon | Majburiy ustunlar | Izoh |
|---|---|---|
| `loanword` | `word` | `alternatives` va `spelling_variants`, `examples` — `;` bilan ajratiladi; muqobil bo‘sh bo‘lishi mumkin |
| `idiom` | `phrase`, `meaning` | Bir iboraning bir nechta ma’nosi — alohida qatorlarda |
| `lexeme` | `lemma`, `pos` | So‘z tahlili uchun o‘zak va turkum |
| `spelling` | `wrong`, `correct` | Imlo tekshiruvi va mashqlar uchun |

`status` ustuni: `tasdiqlangan` / `tekshirilmoqda` / `rad etilgan` (bo‘sh bo‘lsa, import oynasida tanlangan qiymat). Import qilingan yozuvlar “Asosiy baza” (OFFICIAL) deb belgilanadi; qidiruvda avval shu baza ishlatiladi.

**Eksport va zaxira:** Admin paneli → Eksport (CSV/XLSX, import shabloni bilan bir xil ustunlar, formula injection’dan himoyalangan) va JSON zaxira. To‘liq zaxira (foydalanuvchilar bilan) uchun:

```bash
pg_dump --format=custom "$DATABASE_URL" > ozbegim-$(date +%F).dump
pg_restore --clean --dbname "$DATABASE_URL" ozbegim-YYYY-MM-DD.dump
```

## Claude Code bulut sessiyalari

`.claude/hooks/session-start.sh` bulut sessiyasi boshlanganda `npm install`, PostgreSQL’ni ishga tushirish, ishlab chiqish bazasi va `.env` (faqat mahalliy qiymatlar) hamda migratsiyalarni bajaradi. Hook sinxron ishlaydi.

## Testlar

```bash
npm run typecheck
npm test                       # Vitest: birlik + integratsion (ishlayotgan server va baza kerak)
npm run test:e2e               # Playwright: kompyuter va telefon o‘lchamlarida
```

Integratsion va E2E testlar `TEST_BASE_URL` (standart `http://localhost:3000`) dagi serverga murojaat qiladi va `.env` dagi bazadan foydalanadi. Testlar uchun server shunday ishga tushiriladi:

```bash
npm run build
AUTH_SIGNUP_PER_HOUR=10000 AUTH_SIGNIN_PER_MINUTE=1000 npm start &
npm run worker &
npm test && npm run test:e2e
# Chromium boshqa joyda bo‘lsa: PW_CHROMIUM_PATH=/yo‘l/chrome npm run test:e2e
```

Test natijalari (haqiqiy yugurish) — [docs/TEST-NATIJALARI.md](docs/TEST-NATIJALARI.md).

## Joylashtirish (deploy)

**Variant A — oddiy server (VPS):**

1. PostgreSQL 16 o‘rnating, baza va foydalanuvchi yarating.
2. `npm ci && npm run build && npm run db:migrate`
3. `.env` ni to‘ldiring (`BETTER_AUTH_URL=https://sizning-domen.uz`, `TRUST_PROXY=true`, kuchli `BETTER_AUTH_SECRET`).
4. Ikkita jarayonni systemd/pm2 bilan doimiy ishlating: `npm start` va `npm run worker`.
5. Oldiga Nginx/Caddy qo‘yib HTTPS ulang. Yuklash hajmi uchun proxy’da `client_max_body_size 25m;`.
6. OCR uchun (ixtiyoriy, bepul): `apt install tesseract-ocr tesseract-ocr-uzb tesseract-ocr-uzb-cyrl poppler-utils` va `OCR_PROVIDER=tesseract` (poppler-utils — skanerlangan PDF uchun).

**Variant B — Docker Compose:** `Dockerfile` va `docker-compose.yml` (db, migrate, web, worker, umumiy fayl hajmi) tayyorlangan:

```bash
cp .env.example .env    # POSTGRES_PASSWORD, BETTER_AUTH_SECRET, BETTER_AUTH_URL ni to‘ldiring
docker compose up -d --build
docker compose exec web npm run admin:grant -- sizning@pochtangiz.uz
```

> **Diqqat:** Docker obrazi ishlab chiquvchi muhitida to‘liq yig‘ilmadi — konteyner ichidan npm reestriga ulanish sandbox tarmog‘i tomonidan uzildi. Dockerfile standart buyruqlardan iborat, lekin birinchi ishga tushirishda tekshirib ko‘ring.

**Fayl saqlash:** bir nechta server nusxasi bo‘lsa `STORAGE_DRIVER=s3` (AWS S3, Cloudflare R2, MinIO — bucket yopiq bo‘lishi shart). S3 drayveri `@aws-sdk/client-s3` bilan yozilgan, lekin haqiqiy S3 xizmatiga qarshi sinalmagan.

Pulli xizmatlar avtomatik ulanmaydi: AI (Anthropic API) faqat `ANTHROPIC_API_KEY` berilsa ishlaydi va foydalanuvchi har safar matn yuborishga rozilik bildiradi.

## Imkoniyatlar holati

Saytdagi “Imkoniyatlar holati” sahifasi (`/holat`) joriy holatni jonli ko‘rsatadi.

**Ishlaydi**
- Lotin ↔ kirill matn konvertori: avtomatik yozuv aniqlash, aralash yozuv izohi, o‘, g‘, sh, ch, ng, tutuq, katta-kichik harflar, istisnolar; URL, email, kod, formula va `{{belgilangan}}` parchalar himoyasi; “Tekshirish tavsiya etiladi” belgilari; katta matnlar Web Worker’da.
- Fayllar: TXT, CSV, DOCX, XLSX, PPTX, SRT, VTT (tuzilma, bezaklar, formulalar, sonlar, sanalar, vaqt belgilari saqlanadi); bir nechta fayl, holat, qayta urinish, bekor qilish, o‘chirish, muddat.
- Iboralar va o‘zlashma so‘zlar qidiruvi (lotin/kirill/apostrof variantlari, yaqin natijalar), izohlar, ovozlar, shikoyatlar, moderatsiya, taklifni lug‘at yozuviga aylantirish.
- Shaxsiy lug‘at (papka, teg, qayd, qidiruv, CSV/JSON eksport), mashqlar va SM-2 kartochkalar, matn statistikasi, rozilikka asoslangan ish tarixi.
- Admin: lug‘at CRUD, import/eksport, zaxira, foydalanuvchilar, audit jurnali, topilmagan/ko‘p qidirilgan so‘zlar.
- OCR (JPG/PNG va skanerlangan PDF, dastlabki 30 sahifa) — serverda Tesseract (+ poppler-utils) o‘rnatilgan va `OCR_PROVIDER=tesseract` bo‘lsa. Fayl server ichida qayta ishlanadi, tashqariga yuborilmaydi.

**Cheklangan**
- Matnli PDF — matn ajratiladi va tahrirlanadi, lekin asl joylashuv saqlanmaydi (natija TXT/DOCX).
- Imlo tekshiruvi — to‘liq o‘zbek tili lug‘ati yo‘q; faqat aniq qoidalar, bir ma’noli xatolar ro‘yxati va bazadagi tasdiqlangan juftliklar.
- So‘z va gap tahlili — qoidaviy; aniqligi `lexeme` lug‘atining to‘liqligiga bog‘liq. Natijalar “lug‘at / qoida / taxmin” deb belgilanadi.
- DOCX/PPTX ichidagi diagramma va SmartArt matni o‘girilmaydi (ogohlantirish beriladi); XLSX varaq nomlari formulalar buzilmasligi uchun o‘zgartirilmaydi.

**Hali ulanmagan**
- AI tavsiyalari (imlo, gap tahlili) — kod tayyor, `ANTHROPIC_API_KEY` kerak.
- Audio/video transkripsiyasi — xizmat tanlanmagan; interfeys buni ochiq aytadi.
- Rasmdagi yozuvni almashtirish — amalga oshirilmagan.
- Eski DOC/XLS/PPT — bevosita qo‘llanmaydi, qayta saqlash yo‘riqnomasi ko‘rsatiladi.

## Loyiha tuzilishi

```
prisma/                  Sxema va migratsiyalar
src/lib/uz/              Til mantig‘i (frameworkdan mustaqil):
  translit.ts            transliteratsiya (tokenlar manba oralig‘i bilan)
  protect.ts             o‘zgarmas parchalar
  normalize.ts           qidiruv kaliti
  script.ts              yozuvni aniqlash
  spelling/              imlo qoidalari
  analysis/              morfologiya, fonetika, gap tahlili
  stats.ts               matn statistikasi
src/lib/files/           Fayl turi aniqlash, ZIP tekshiruvi, formatlar (DOCX/XLSX/PPTX/CSV/SRT/VTT/PDF), OCR
src/lib/server/          Baza, autentifikatsiya, ruxsatlar, rate limit, saqlash, vazifalar, import, AI
src/app/                 Sahifalar va API marshrutlari
scripts/                 worker, cleanup, admin:grant, seed, shablonlar
data/demo/               Namuna ma’lumotlar (DEMO belgisi bilan)
templates/               Import shablonlari
tests/                   unit, integration, e2e
docs/                    Qoidalar, xavfsizlik, test natijalari
```

Logotip vaqtinchalik matnli belgi: `src/components/brand/Logo.tsx` va `src/app/icon.svg` — haqiqiy logotip tayyor bo‘lganda faqat shu ikki faylni almashtiring.

## Xavfsizlik va maxfiylik

Batafsil: [docs/XAVFSIZLIK.md](docs/XAVFSIZLIK.md). Transliteratsiya qoidalari: [docs/TRANSLITERATSIYA.md](docs/TRANSLITERATSIYA.md).
