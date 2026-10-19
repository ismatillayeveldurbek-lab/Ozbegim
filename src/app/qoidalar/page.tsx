import { PageIntro, Panel } from "@/components/ui/primitives";

export const metadata = { title: "O‘girish qoidalari" };

const L2C = [
  ["a, b, d, f, g, i, j, k, l, m, n, o, p, r, s, t, u, v, x, z", "а, б, д, ф, г, и, ж, к, л, м, н, о, п, р, с, т, у, в, х, з"],
  ["h, q, y", "ҳ, қ, й"],
  ["o‘, g‘ (o‘, o', oʻ, o’, o` — barchasi)", "ў, ғ"],
  ["sh, ch, ng", "ш, ч, нг"],
  ["yo, yu, ya, ye", "ё, ю, я, е (yo‘l → йўл: o‘ dan oldingi y — й)"],
  ["e — so‘z boshida va unlidan keyin", "э (ekin → экин, poeziya → поэзия)"],
  ["e — undoshdan keyin", "е (kecha → кеча)"],
  ["tutuq belgisi (’) so‘z ichida", "ъ (ma’no → маъно)"],
  ["s’h — ajratuvchi apostrof", "сҳ (Is’hoq → Исҳоқ)"],
];
const C2L = [
  ["е — so‘z boshida, unli, ъ yoki ь dan keyin", "ye (ер → yer, объект → obyekt)"],
  ["е — undoshdan keyin", "e"],
  ["ц — so‘z boshida va undoshdan keyin", "s (цирк → sirk)"],
  ["ц — unlidan keyin", "ts (милиция → militsiya)"],
  ["ъ — unlidan keyin yoki undoshdan keyin (e/ё/ю/я dan oldin emas)", "’ (маъно → ma’no)"],
  ["ь", "tushirib qoldiriladi (компьютер → kompyuter)"],
  ["ё, ю, я", "yo, yu, ya"],
  ["ў, ғ", "o‘, g‘ (uslub tanlanadi: o‘ / oʻ / o')"],
  ["сҳ", "s’h (sh bilan adashmasligi uchun)"],
];

export default function Page() {
  return (
    <>
      <PageIntro title="Lotin ↔ kirill o‘girish qoidalari">O‘zbek tilining amaldagi lotin alifbosi (1995) va kirill alifbosi o‘rtasidagi moslik.</PageIntro>
      <div className="flex flex-col gap-4">
        {[
          ["Lotin → kirill", L2C],
          ["Kirill → lotin", C2L],
        ].map(([t, rows]) => (
          <Panel key={t as string}>
            <h3 className="mb-2 text-lg font-bold">{t as string}</h3>
            <table className="w-full text-left text-[0.98rem]">
              <tbody>
                {(rows as string[][]).map(([a, b]) => (
                  <tr key={a} className="border-t border-line align-top">
                    <td className="w-1/2 py-2 pr-3">{a}</td>
                    <td className="py-2 font-semibold">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
        <Panel>
          <h3 className="mb-2 text-lg font-bold">Katta-kichik harflar</h3>
          <p className="text-ink-soft">
            Ikki harfli birikmalar so‘z holatiga qarab yoziladi: <strong>Shahar → Шаҳар</strong>, <strong>SHAHAR → ШАҲАР</strong>, <strong>Ўзбекистон → O‘zbekiston</strong>,{" "}
            <strong>ЧОЙ → CHOY</strong>.
          </p>
        </Panel>
        <Panel>
          <h3 className="mb-2 text-lg font-bold">Nega o‘girish har doim ham qaytariladigan emas</h3>
          <ul className="list-inside list-disc text-ink-soft">
            <li>Lotin yozuvida “ц”, “ь”, “ъ” harflari yo‘q: “sirk” kirillda “цирк”, “sirka” esa “сирка”. Bunday o‘zlashma so‘zlar uchun kichik istisnolar ro‘yxati ishlatiladi va natija belgilanadi.</li>
            <li>Ism-familiya, joy nomlari va brendlar o‘ziga xos yozilishi mumkin — gap o‘rtasidagi bosh harfli so‘zlar “Tekshirish tavsiya etiladi” bilan belgilanadi.</li>
            <li>Qisqartmalar (BMT, IT) ba’zan o‘girilmaydi — bosh harfli qisqa so‘zlar belgilanadi.</li>
            <li>Apostrof qo‘shtirnoq sifatida ishlatilgan bo‘lsa (‘bog’), u o‘/g‘ bilan adashishi mumkin.</li>
          </ul>
        </Panel>
        <Panel>
          <h3 className="mb-2 text-lg font-bold">O‘zgarmaydigan parchalar</h3>
          <ul className="list-inside list-disc text-ink-soft">
            <li>Havolalar: https://…, www.…, kun.uz kabi domenlar (oxiridagi nuqta va qavs havolaga qo‘shilmaydi).</li>
            <li>Elektron pochta manzillari.</li>
            <li>Kod: ```…``` bloklari va `inline` kod (o`zbek kabi apostrof sifatidagi belgi kod hisoblanmaydi).</li>
            <li>Formulalar: $…$, $$…$$, \(…\), \[…\] va “=” bilan boshlanuvchi jadval formulalari (=SUM(A1:A3)). “$5” kabi narxlar formula emas.</li>
            <li>Siz belgilagan parchalar: {"{{matn}}"} — natijada qavslarsiz, o‘zgarishsiz chiqadi.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
