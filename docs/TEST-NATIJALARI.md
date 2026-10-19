# Test natijalari

Sana: 2026-10-19 · muhit: Linux, Node v22.22.0, PostgreSQL 16, Chromium (Playwright 1.56), prod build (`next build && next start`) + `npm run worker`.

## Buyruqlar va natijalar

```
$ npx prisma migrate deploy   # toza bazada
All migrations have been successfully applied.  (32 jadval)
$ npm run typecheck
xatosiz
$ npm run build
muvaffaqiyatli (3 ta Turbopack ogohlantirishi: fayl tizimiga dinamik murojaat — storage/ocr modullari)
$ npm test
 Test Files  9 passed (9)
      Tests  89 passed | 1 skipped (90)
$ npm run test:e2e
14 passed (27.1s)
```

## Vitest (birlik + integratsion) — har bir test

```
 ✓ tests/integration/phase1.test.ts > autentifikatsiya va rollar > ro‘yxatdan o‘tgan birinchi foydalanuvchi ham admin bo‘lmaydi; role maydonini yuborib bo‘lmaydi
 ✓ tests/integration/phase1.test.ts > autentifikatsiya va rollar > oddiy foydalanuvchi admin API’ga kira olmaydi, mehmon esa 401 oladi
 ✓ tests/integration/phase1.test.ts > autentifikatsiya va rollar > boshqa saytdan kelgan (Origin mos emas) so‘rov rad etiladi
 ✓ tests/integration/phase1.test.ts > lug‘at qidiruvi > lotin, kirill va apostrof variantlari bir xil yozuvni topadi
 ✓ tests/integration/phase1.test.ts > lug‘at qidiruvi > ibora topilmasa bo‘sh natija va yaqin natijalar qaytadi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > mavjud bo‘lmagan so‘z uchun aniq xabar va izoh bo‘limi (bo‘sh muhokama) qaytadi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > mehmon izoh qoldira olmaydi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > ikki foydalanuvchi bir muhokamadagi izohlarni ko‘radi; kirill varianti o‘sha muhokamaga tushadi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > parallel so‘rovlar takroriy muhokama yaratmaydi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > takroriy izoh, havolali spam va honeypot rad etiladi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > ovozlar izohni tasdiqlangan qilmaydi; shikoyatlar uni yashiradi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > rate limit: bir foydalanuvchi 10 daqiqada 5 tadan ortiq izoh qoldira olmaydi
 ✓ tests/integration/phase1.test.ts > o‘zlashma so‘zlar va izohlar > admin taklifni tasdiqlangan yozuvga aylantiradi va audit yoziladi
 ✓ tests/integration/phase2.test.ts > admin importi > oddiy foydalanuvchi import qila olmaydi
 ✓ tests/integration/phase2.test.ts > admin importi > xatolar satr raqami bilan, takrorlar va mavjud yozuvlar aniqlanadi; skip/update qoidasi
 ✓ tests/integration/phase2.test.ts > admin importi > XLSX: varaq tanlash va bir iboraning bir nechta ma’nosi
 ✓ tests/integration/phase2.test.ts > admin importi > xatoli import bazani yarim holatda qoldirmaydi (tranzaksiya qaytariladi)
 ✓ tests/integration/phase2.test.ts > admin importi > eksport CSV/XLSX’da formula injection’ga qarshi himoya
 ✓ tests/integration/phase2.test.ts > shaxsiy lug‘at va tarix > boshqa foydalanuvchi shaxsiy yozuvni ocha, o‘zgartira, o‘chira, eksport qila olmaydi
 ✓ tests/integration/phase2.test.ts > shaxsiy lug‘at va tarix > boshqa foydalanuvchining papkasiga yozuv qo‘shib bo‘lmaydi
 ✓ tests/integration/phase2.test.ts > shaxsiy lug‘at va tarix > tarix faqat rozilik bilan; meta rejimida matn saqlanmaydi; o‘chirish
 ✓ tests/unit/ocr.test.ts > OCR (Tesseract) > rasmdan matn ajratiladi va tekshirish uchun qaytariladi
 ✓ tests/unit/ocr.test.ts > OCR (Tesseract) > skanerlangan PDF (faqat rasm) sahifalari OCR qilinadi
 ✓ tests/integration/files.test.ts > fayl vazifalari > XLSX yuklanadi, ishlanadi va natijada formulalar/sonlar saqlanadi
 ✓ tests/integration/files.test.ts > fayl vazifalari > boshqa foydalanuvchi faylni ko‘ra, yuklab ola, o‘chira olmaydi
 ✓ tests/integration/files.test.ts > fayl vazifalari > qo‘llanmaydigan, mos kelmaydigan va katta fayllar rad etiladi
 ✓ tests/integration/files.test.ts > fayl vazifalari > buzilgan DOCX vazifasi xato sababi bilan tugaydi
 ✓ tests/integration/files.test.ts > fayl vazifalari > foydalanuvchi faylni o‘chiradi — saqlashdagi obyektlar ham o‘chadi
 ✓ tests/integration/files.test.ts > fayl vazifalari > muddati tugagan fayllar tozalanadi, muddati tugamaganlar qoladi
 ✓ tests/integration/files.test.ts > fayl vazifalari > bekor qilish va qayta urinish
 ✓ tests/integration/phase3.test.ts > so‘z va gap tahlili API > so‘z: bo‘g‘in, harflar, lug‘atdagi o‘zak (namuna lug‘at)
 ✓ tests/integration/phase3.test.ts > so‘z va gap tahlili API > kirill kiritish ham tahlil qilinadi
 ✓ tests/integration/phase3.test.ts > so‘z va gap tahlili API > gap tahlili
 ✓ tests/integration/phase3.test.ts > mashqlar > namuna (DEMO) va tekshirilmagan yozuvlar savollar soniga kirmaydi
 ✓ tests/integration/phase3.test.ts > mashqlar > savol → javob → tushuntirish; urinish tarixga yoziladi; tokenni soxtalashtirib bo‘lmaydi
 ✓ tests/integration/phase3.test.ts > mashqlar > kartochkalar: baho bo‘yicha keyingi takrorlash vaqti
 ✓ tests/integration/phase3.test.ts > tashqi xizmatlar ulanmaganda natija to‘qilmaydi > AI endpointlari 503 qaytaradi; holat sahifasi “ulanmagan” deydi
 ✓ tests/unit/files.test.ts > DOCX > run’lar orasida bo‘lingan Sh/O‘ birikmalari va bezaklar saqlanadi
 ✓ tests/unit/files.test.ts > DOCX > matn qutisi (ichma-ich paragraf) to‘g‘ri ishlanadi
 ✓ tests/unit/files.test.ts > PPTX > slayd matni o‘giriladi, tuzilma saqlanadi
 ✓ tests/unit/files.test.ts > XLSX > formulalar, sonlar, sanalar va varaq nomlari o‘zgarmaydi
 ✓ tests/unit/files.test.ts > CSV > ajratgich, qo‘shtirnoq, ekranlash va qator oxirlari saqlanadi
 ✓ tests/unit/files.test.ts > CSV > vergul ajratgichli va oxirida qator belgisi yo‘q fayl
 ✓ tests/unit/files.test.ts > Subtitrlar > SRT vaqt belgilari va raqamlar o‘zgarmaydi, teglar saqlanadi
 ✓ tests/unit/files.test.ts > Subtitrlar > VTT sarlavha, NOTE, STYLE, cue identifikatori va sozlamalar saqlanadi
 ✓ tests/unit/files.test.ts > PDF > matnli PDF’dan matn ajratiladi va tekshirish uchun qaytariladi
 ↓ tests/unit/files.test.ts > PDF > matnsiz (skanerlangan) PDF OCR xizmati ulanmaganini aytadi
 ✓ tests/unit/files.test.ts > Fayllarni rad etish > bo‘sh, mos kelmaydigan, eski, makrosli, media va noma’lum formatlar
 ✓ tests/unit/files.test.ts > Fayllarni rad etish > buzilgan arxiv, ZIP bomb va zararli yo‘llar
 ✓ tests/unit/files.test.ts > Fayllarni rad etish > Windows-1251 kodlashdagi kirill TXT o‘qiladi
 ✓ tests/unit/analysis.test.ts > bo‘g‘in va harf-tovush > bo‘g‘inlarga ajratish
 ✓ tests/unit/analysis.test.ts > bo‘g‘in va harf-tovush > harflar soni: o‘, sh, ng — bitta harf; tutuq — belgi
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > ot: ko‘plik, egalik, kelishik
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > fe’l: zamon va shaxs
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > so‘z yasovchi va turkumdan o‘tish
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > tovush almashinuvi
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > bir nechta tahlil (omonimlar)
 ✓ tests/unit/analysis.test.ts > morfologik tahlil > lug‘atda yo‘q o‘zak — qoidaviy taxmin
 ✓ tests/unit/analysis.test.ts > gap tahlili > ega, kesim, to‘ldiruvchi, hol, aniqlovchi
 ✓ tests/unit/analysis.test.ts > gap tahlili > noaniq holat muqobil talqin bilan beriladi
 ✓ tests/unit/analysis.test.ts > gap tahlili > yashirin ega haqida ogohlantirish
 ✓ tests/unit/analysis.test.ts > matn statistikasi > belgi, so‘z, gap, paragraf va yozuv tarkibi
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > o‘/g‘ va tutuq xatolari, katta harf
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > apostrof uslubi va noto‘g‘ri belgilar
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > atoqli otlar, ism-familiyaga tegmaslik
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > qo‘shib, ajratib va chiziqcha bilan yozish
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > bo‘shliqlar
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > tinish belgilari faqat yoqilganda
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > shaxsiy lug‘at va himoyalangan parchalar e’tiborsiz qoldiriladi
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > kirill matn: bazadagi juftlik va aralash yozuv
 ✓ tests/unit/spelling.test.ts > imlo tekshiruvi > kontekstga bog‘liq so‘zlar xato deb belgilanmaydi
 ✓ tests/unit/spelling.test.ts > tavsiyalarni xavfsiz qo‘llash > bittasini qabul qilgandan keyin qolganlari to‘g‘ri joyga tushadi (qayta hisoblash)
 ✓ tests/unit/spelling.test.ts > tavsiyalarni xavfsiz qo‘llash > barchasini qabul qilish va ortga qaytarish
 ✓ tests/unit/translit.test.ts > lotin → kirill > asosiy qabul mezonlari
 ✓ tests/unit/translit.test.ts > lotin → kirill > apostrof variantlari bir xil natija beradi
 ✓ tests/unit/translit.test.ts > lotin → kirill > katta-kichik harflar
 ✓ tests/unit/translit.test.ts > lotin → kirill > sh, ch, ng, y+unli, e qoidasi va tutuq
 ✓ tests/unit/translit.test.ts > lotin → kirill > istisnolar faqat qo‘shimcha zanjiri bilan qo‘llanadi va belgilanadi
 ✓ tests/unit/translit.test.ts > lotin → kirill > ismlar va qisqartmalar tekshirish uchun belgilanadi
 ✓ tests/unit/translit.test.ts > kirill → lotin > asosiy holatlar
 ✓ tests/unit/translit.test.ts > kirill → lotin > apostrof uslubi
 ✓ tests/unit/translit.test.ts > kirill → lotin > qaytariladigan oddiy matn
 ✓ tests/unit/translit.test.ts > himoyalangan parchalar > URL, email va kod o‘zgarmaydi
 ✓ tests/unit/translit.test.ts > himoyalangan parchalar > chegaraviy holatlar
 ✓ tests/unit/translit.test.ts > himoyalangan parchalar > himoyani o‘chirib qo‘yish mumkin
 ✓ tests/unit/translit.test.ts > tokenlar manba oralig‘ini saqlaydi > har bir token manbaga mos
 ✓ tests/unit/translit.test.ts > yozuvni aniqlash > lotin, kirill, aralash
 ✓ tests/unit/translit.test.ts > qidiruv kaliti > lotin/kirill va apostrof variantlari bitta kalit
 ✓ tests/unit/translit.test.ts > qidiruv kaliti > turli so‘zlar birlashmaydi
 ✓ tests/unit/translit.test.ts > qidiruv kaliti > tinish belgilari va tirelar
```

## Playwright (kompyuter 1366×900 va telefon 390×844)

```
  ✓   1 [kompyuter] › tests/e2e/app.spec.ts:20:5 › bosh sahifa: to‘rtta asosiy vosita birinchi, gorizontal siljish yo‘q
  ✓   2 [kompyuter] › tests/e2e/app.spec.ts:32:5 › navigatsiya: telefonda pastki menyu va “Yana”, kompyuterda chap panel
  ✓   3 [kompyuter] › tests/e2e/app.spec.ts:48:5 › konvertor: O‘zbekiston → Ўзбекистон, havola o‘zgarmaydi, yo‘nalish almashtirilganda natija yo‘qolmaydi
  ✓   4 [kompyuter] › tests/e2e/app.spec.ts:58:5 › mavjud bo‘lmagan so‘z: aniq xabar va “Izohlar” bo‘limi; ikki foydalanuvchi izohni ko‘radi
  ✓   5 [kompyuter] › tests/e2e/app.spec.ts:81:5 › imlo: qabul qilish, rad etish va ortga qaytarish
  ✓   6 [kompyuter] › tests/e2e/app.spec.ts:97:5 › fayl: TXT yuklanadi, ishlanadi va yuklab olinadi; oddiy foydalanuvchiga admin yopiq
  ✓   7 [kompyuter] › tests/e2e/app.spec.ts:111:5 › tahlil va statistika sahifalari
  ✓   8 [telefon] › tests/e2e/app.spec.ts:20:5 › bosh sahifa: to‘rtta asosiy vosita birinchi, gorizontal siljish yo‘q
  ✓   9 [telefon] › tests/e2e/app.spec.ts:32:5 › navigatsiya: telefonda pastki menyu va “Yana”, kompyuterda chap panel
  ✓  10 [telefon] › tests/e2e/app.spec.ts:48:5 › konvertor: O‘zbekiston → Ўзбекистон, havola o‘zgarmaydi, yo‘nalish almashtirilganda natija yo‘qolmaydi
  ✓  11 [telefon] › tests/e2e/app.spec.ts:58:5 › mavjud bo‘lmagan so‘z: aniq xabar va “Izohlar” bo‘limi; ikki foydalanuvchi izohni ko‘radi
  ✓  12 [telefon] › tests/e2e/app.spec.ts:81:5 › imlo: qabul qilish, rad etish va ortga qaytarish
  ✓  13 [telefon] › tests/e2e/app.spec.ts:97:5 › fayl: TXT yuklanadi, ishlanadi va yuklab olinadi; oddiy foydalanuvchiga admin yopiq
  ✓  14 [telefon] › tests/e2e/app.spec.ts:111:5 › tahlil va statistika sahifalari
```

OCR testlari (rasm va skanerlangan PDF) serverda Tesseract (uzb, uzb_cyrl) va poppler-utils o‘rnatilgan holda o‘tdi; Tesseract bo‘lmagan muhitda ular o‘tkazib yuboriladi. “OCR ulanmagan” testi esa OCR yoqilgan muhitda o‘tkazib yuboriladi (↓).

Docker obrazi bu muhitda yig‘ilmadi (konteyner ichidan npm reestriga ulanish sandbox tarmog‘ida uzildi) — sinalmagan.
