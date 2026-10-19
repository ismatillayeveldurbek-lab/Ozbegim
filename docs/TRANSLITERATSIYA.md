# Lotin ↔ kirill transliteratsiya qoidalari

Kod: `src/lib/uz/translit.ts`, istisnolar: `src/lib/uz/translit-exceptions.ts`, himoyalangan parchalar: `src/lib/uz/protect.ts`. Testlar: `tests/unit/translit.test.ts`.

## Lotin → kirill

| Lotin | Kirill | Izoh |
|---|---|---|
| a b d f g i j k l m n o p r s t u v x z | а б д ф г и ж к л м н о п р с т у в х з | |
| h, q, y | ҳ, қ, й | |
| o‘, g‘ | ў, ғ | Apostrof turlari: ‘ ’ ' ` ʻ ʼ ´ — barchasi qabul qilinadi. So‘z oxirida ham (bog‘ → боғ). |
| sh, ch | ш, ч | |
| ng | нг | |
| yo, yu, ya, ye | ё, ю, я, е | `yo‘` istisno: yo‘l → йўл |
| e | э / е | So‘z boshida va unlidan keyin — э (ekin, poeziya), aks holda — е |
| ’ (so‘z ichida) | ъ | ma’no → маъно |
| s’h | сҳ | Is’hoq → Исҳоқ (apostrof — ajratuvchi) |
| c, w va boshqa | o‘zgarmaydi | “Xorijiy harflar” belgisi qo‘yiladi |

## Kirill → lotin

| Kirill | Lotin | Izoh |
|---|---|---|
| е | ye / e | So‘z boshida, unlidan, ъ yoki ь dan keyin — ye |
| ё ю я | yo yu ya | |
| ц | s / ts | So‘z boshida va undoshdan keyin — s, unlidan keyin — ts. Har doim belgilanadi |
| ъ | ’ / — | Undoshdan keyin va е/ё/ю/я oldidan tushiriladi (объект → obyekt), aks holda ’ |
| ь | — | tushiriladi |
| щ | sh | belgilanadi |
| ы, э | i, e | |
| ў, ғ | o‘, g‘ | uslub: `o‘ ’` (standart), `oʻ ʼ` (rasmiy Unicode) yoki `o' '` |
| сҳ | s’h | |

## Katta-kichik harflar

So‘z butunlay katta harflarda bo‘lsa, ikki harfli birikma ham katta yoziladi (ШАҲАР → SHAHAR), aks holda faqat birinchisi (Шаҳар → Shahar).

## “Tekshirish tavsiya etiladi” belgilari

- gap o‘rtasidagi bosh harfli so‘z (ism, joy nomi);
- 2–6 harfli to‘liq katta harfli so‘z (qisqartma);
- istisnolar ro‘yxati qo‘llangan so‘z (sirk → цирк);
- lotinda “ts” (ц bo‘lishi mumkin), kirillda “ц”, “щ”;
- bir so‘zda lotin va kirill harflari aralash;
- o‘zbek alifbosida yo‘q lotin harflari.

## Istisnolar

Istisno o‘zagi faqat so‘zning qolgan qismi ma’lum qo‘shimchalar zanjiri bo‘lsa qo‘llanadi: `sirkda` → `циркда`, lekin `sirka` → `сирка`.

## Himoyalangan parchalar

URL (oxiridagi tinish belgilari va juft bo‘lmagan qavs chiqarib tashlanadi, `Tashkent_(city)` kabi juft qavslar saqlanadi), protokolsiz domenlar (`kun.uz`), email, ```kod bloklari``` (yopilmaganlari — oddiy matn), `inline kod` (harfdan keyingi ` belgi — apostrof, kod emas), `$…$`/`$$…$$`/`\(…\)`/`\[…\]` formulalar (`$5 va $10` — narx, formula emas), `=` bilan boshlanuvchi jadval formulalari, `{{foydalanuvchi belgilagan}}` parchalar (natijada qavslarsiz).

## Fayllarda

DOCX/PPTX/XLSX’da paragraf matni birlashtirilib o‘giriladi, har bir chiqish tokeni manbadagi joyiga qarab asl run’ga qaytariladi — turli formatdagi run’lar orasida bo‘lingan “S|h” to‘g‘ri “Ш” bo‘ladi, bezaklar saqlanadi.
