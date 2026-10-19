/**
 * Lotin/kirill mashqi uchun chalg‘ituvchi variantlar: ko‘p uchraydigan adashishlar
 * (ў↔у, ҳ↔х, қ↔к, ғ↔г, е↔э, ё↔йо). Har biri to‘g‘ri javobdan farq qilishi kafolatlanadi.
 */
const SWAPS: Array<[RegExp, string]> = [
  [/ў/g, "у"],
  [/ҳ/g, "х"],
  [/қ/g, "к"],
  [/ғ/g, "г"],
  [/^э/, "е"],
  [/ё/g, "йо"],
  [/ш/g, "сҳ"],
  [/ъ/g, ""],
  [/ч/g, "тш"],
  [/я/g, "йа"],
];

export function cyrillicDistractors(correct: string, count = 3): string[] {
  const out = new Set<string>();
  for (const [re, rep] of SWAPS) {
    const v = correct.replace(re, rep);
    if (v !== correct) out.add(v);
    if (out.size >= count) break;
  }
  // Yetmasa — ikki xil almashtirishni birlashtiramiz
  const list = [...out];
  for (let i = 0; out.size < count && i < list.length; i++)
    for (const [re, rep] of SWAPS) {
      const v = list[i].replace(re, rep);
      if (v !== correct && v !== list[i]) out.add(v);
      if (out.size >= count) break;
    }
  return [...out].slice(0, count);
}

export function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
