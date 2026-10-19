# Xavfsizlik va maxfiylik

| Talab | Amalga oshirilishi |
|---|---|
| Kiruvchi ma’lumotlarni tekshirish | Har bir API’da `zod` sxemalari (`src/lib/server/*`, `src/app/api/**`); JSON hajmi cheklangan (`readJson`). |
| Egalik va ruxsat | Yopiq resurslar (fayllar, shaxsiy lug‘at, tarix, kartochkalar, import vazifalari) har so‘rovda `userId` bo‘yicha tekshiriladi; begona resurs uchun 404 (mavjudligi ham oshkor qilinmaydi). Admin/moderator roli bazadan o‘qiladi (`requireAdmin`, `requireStaff`). |
| XSS | React matnni avtomatik ekranlaydi; foydalanuvchi matni uchun `dangerouslySetInnerHTML` ishlatilmaydi. Manba havolalari faqat `http(s)` (javascript: rad etiladi), `rel="nofollow ugc noopener"`. Importda boshqaruv belgilari tozalanadi. |
| Sessiya va CSRF | Better Auth — bazadagi sessiyalar, `httpOnly`, `SameSite=Lax` cookie, prod’da `Secure`. Holatni o‘zgartiruvchi barcha ilova API’larida `Origin`/`Referer` tekshiruvi (`assertSameOrigin`); Better Auth endpointlari o‘z Origin tekshiruviga ega. |
| Rate limit va spam | Kirish (5/daq), ro‘yxatdan o‘tish (5/soat) — Better Auth, bazada. Ilova: izoh (foydalanuvchiga 5/10 daq, IP’ga 20/soat), ovoz, shikoyat, qidiruv, yuklash, AI. Izohlarda honeypot maydon, havolalar soni, takroriy belgilar va takroriy izoh (hash) tekshiruvi; 3 ta ochiq shikoyat — izoh avtomatik yashiriladi. |
| Fayl turi | Kengaytma **va** baytlar (magic bytes, OOXML tuzilmasi, UTF-8/NUL tekshiruvi) mos bo‘lishi shart (`src/lib/files/detect.ts`). |
| Hajm va arxiv chegaralari | Fayl ≤ `FILE_MAX_MB`; ZIP ochilmasdan markaziy katalog tekshiriladi: fayllar soni, umumiy va bitta faylning ochilgan hajmi, siqish nisbati (ZIP bomb), `../`, absolyut va `\` yo‘llar, shifrlangan arxivlar (`zip-inspect.ts`). PDF ≤ 300 sahifa. Import ≤ 20 000 qator, 15 MB. |
| Makroslar | `.docm/.xlsm/.pptm/.xlsb` va ichida `vbaProject.bin` bor fayllar rad etiladi. |
| Yopiq saqlash | Fayllar `public/` dan tashqarida (`0600` huquq) yoki yopiq S3 bucket’da; kalitlar tasodifiy UUID, yo‘l chiqib ketishiga qarshi tekshiruv. Yuklab olish faqat egalik tekshiriladigan API orqali, `Cache-Control: private, no-store`. |
| Avtomatik tozalash | `expiresAt` bo‘yicha ishchi (har 10 daqiqa) yoki `npm run cleanup`; foydalanuvchi o‘zi ham o‘chira oladi. |
| Loglar | Foydalanuvchi matni va hujjatlari loglarga yozilmaydi (faqat xato turi/kodi). Audit jurnalida matn emas, faqat metama’lumot. |
| Tashqi xizmatlar | AI’ga matn faqat foydalanuvchi har safar rozilik belgisini qo‘yganda yuboriladi; qaysi xizmatga yuborilishi oldindan yoziladi. Xizmat ulanmagan bo‘lsa 503 va “Xizmat ulanmagan” — natija to‘qilmaydi. OCR serverning o‘zida (Tesseract) ishlaydi. |
| CSV/XLSX formula injection | Eksportda `= + - @ TAB CR` bilan boshlanuvchi kataklar oldiga `'` qo‘shiladi (`src/lib/csv.ts`). |
| Mashq javoblari | To‘g‘ri javob mijozga yuborilmaydi — HMAC bilan imzolangan, 30 daqiqalik token ichida. |
| Maxfiy kalitlar | Faqat server muhit o‘zgaruvchilarida; `.env` Git’ga kirmaydi; `.env.example` qiymatlarsiz. |
| HTTP sarlavhalar | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. |

## Ma’lum cheklovlar

- Mashq tokenini muddati ichida qayta yuborish mumkin (statistikani sun’iy oshirish) — natija baholanmaydigan shaxsiy mashq bo‘lgani uchun qoldirilgan.
- IP bo‘yicha rate limit `TRUST_PROXY=true` bo‘lmasa umumiy kalitga tushadi — proxy ortida albatta yoqing.
- Elektron pochtani tasdiqlash va parolni tiklash xati yuborilmaydi (pochta xizmati ulanmagan).
