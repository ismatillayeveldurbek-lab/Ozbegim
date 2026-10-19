/**
 * Gap bo‘laklarini qoidaviy aniqlash (taxminiy).
 *
 * Muhim: gap bo‘lagi faqat kelishik qo‘shimchasi yoki bitta so‘roq bilan qat’iy belgilanmaydi.
 * Shu sababli har bir natija asos (qoida/lug‘at) va izoh bilan beriladi, noaniq holatlarda
 * muqobil talqin ham ko‘rsatiladi.
 */
import { normalizeKey } from "../normalize";
import { analyzeWord, inferPos, type LexiconEntry, type MorphAnalysis } from "./morphology";

export type Role = "ega" | "kesim" | "aniqlovchi" | "to‘ldiruvchi" | "hol" | "noma’lum";

export interface WordRole {
  index: number;
  word: string;
  role: Role;
  question: string;
  basis: "qoida" | "lug‘at" | "taxmin";
  explanation: string;
  alternative?: string;
  /** Bog‘langan so‘z indeksi (aniqlovchi → aniqlanmish, to‘ldiruvchi/hol → kesim) */
  head?: number;
}

export interface SentenceAnalysis {
  words: string[];
  roles: WordRole[];
  links: Array<{ from: number; to: number; type: string }>;
  warnings: string[];
}

const PRONOUNS = new Map([
  ["men", "1b"],
  ["sen", "2b"],
  ["u", "3"],
  ["biz", "1k"],
  ["siz", "2k"],
  ["ular", "3"],
]);
const DEMONSTRATIVES = new Set(["bu", "shu", "o'sha", "ana", "mana", "u", "har", "hamma", "barcha", "qaysi", "qanday"]);
const TIME_WORDS = new Set(["bugun", "kecha", "ertaga", "hozir", "endi", "doim", "har doim", "kechqurun", "ertalab", "tunda", "kunduzi", "yaqinda", "avval", "keyin", "indin", "o'tgan yili", "hamisha"]);
const MANNER_WORDS = new Set(["tez", "sekin", "asta", "birga", "yolg'iz", "ko'p", "oz", "juda", "yaxshi", "yomon", "zo'r", "jim"]);
const POSTPOSITIONS = new Set(["bilan", "uchun", "haqida", "orqali", "sari", "kabi", "singari", "tomon", "qadar", "bo'ylab"]);
const PLACE_HINT = /(maktab|uy|shahar|qishloq|bozor|ko'cha|xona|bog'|daryo|tog'|ishxona|kutubxona|toshkent|samarqand|buxoro|o'zbekiston|joy|dala|sinf|hovli)/;

function caseOf(a: MorphAnalysis | undefined): string | null {
  const c = a?.affixes.find((x) => /kelishigi/.test(x.name));
  return c ? c.name : null;
}
function hasAffix(a: MorphAnalysis | undefined, re: RegExp) {
  return !!a?.affixes.some((x) => re.test(x.name));
}
function personOf(a: MorphAnalysis | undefined): string | null {
  const p = a?.affixes.find((x) => /(\d)-shaxs/.test(x.name) && x.kind !== "so‘z yasovchi" && !/egalik/.test(x.name));
  if (!p) return null;
  const n = /(\d)-shaxs/.exec(p.name)![1];
  return n + (/ko‘plik/.test(p.name) ? "k" : /birlik/.test(p.name) ? "b" : "");
}

export function analyzeSentence(sentence: string, lexicon: Map<string, LexiconEntry[]>): SentenceAnalysis {
  const words = sentence.match(/\p{L}+(?:['`‘’ʻʼ-]\p{L}+)*/gu) ?? [];
  const warnings: string[] = [];
  if (words.length < 2) return { words, roles: [], links: [], warnings: ["Gap tahlili uchun kamida ikki so‘zli gap kiriting."] };
  if (words.length > 40) warnings.push("Gap juda uzun; qo‘shma gaplarni alohida-alohida tahlil qilish tavsiya etiladi.");

  const keys = words.map((w) => normalizeKey(w));
  const an = words.map((w) => analyzeWord(w, lexicon)[0]);
  const pos = an.map((a, i) => (POSTPOSITIONS.has(keys[i]) ? "ko‘makchi" : PRONOUNS.has(keys[i]) ? "olmosh" : a ? (a.pos ?? inferPos(a)) : null));
  const roles: WordRole[] = words.map((w, i) => ({ index: i, word: w, role: "noma’lum", question: "", basis: "taxmin", explanation: "Bu so‘z uchun ishonchli qoida topilmadi." }));
  const links: SentenceAnalysis["links"] = [];
  const set = (i: number, r: Omit<WordRole, "index" | "word">) => (roles[i] = { index: i, word: words[i], ...r });

  // 1. Kesim: o‘zbek gapida odatda oxirgi mustaqil so‘z; shaxs-son yoki zamon qo‘shimchasi kuchli belgi.
  let k = words.length - 1;
  while (k > 0 && POSTPOSITIONS.has(keys[k])) k--;
  const kesimA = an[k];
  const verbal = pos[k] === "fe’l" || hasAffix(kesimA, /zamon|shaxs|mayli|kesimlik/);
  set(k, {
    role: "kesim",
    question: verbal ? "nima qildi? / nima qilyapti?" : "kim? / nima? / qanday?",
    basis: kesimA?.basis === "lug‘at" ? "lug‘at" : "qoida",
    explanation: verbal
      ? "Gap oxiridagi fe’l shakli; shaxs-son yoki zamon qo‘shimchasi ega haqida xabar berayotganini ko‘rsatadi."
      : "Gap oxirida turgan so‘z. Ot yoki sifat ham kesim bo‘lishi mumkin (ot kesim).",
  });
  const kesimPerson = personOf(kesimA);

  // 2. Kesimga bog‘liq bo‘laklar va aniqlovchilar
  for (let i = 0; i < k; i++) {
    const a = an[i];
    const key = keys[i];
    const c = caseOf(a);
    const next = i + 1 <= k ? i + 1 : -1;
    if (POSTPOSITIONS.has(key)) {
      set(i, { role: "noma’lum", question: "", basis: "qoida", explanation: "Ko‘makchi — mustaqil gap bo‘lagi emas, oldingi so‘z bilan birga bo‘lak hosil qiladi.", head: i - 1 });
      continue;
    }
    if (POSTPOSITIONS.has(keys[i + 1] ?? "")) {
      const pp = keys[i + 1];
      set(i, {
        role: pp === "uchun" ? "hol" : "to‘ldiruvchi",
        question: pp === "bilan" ? "kim bilan? / nima bilan?" : pp === "uchun" ? "nima uchun? / kim uchun?" : pp === "haqida" ? "kim haqida? / nima haqida?" : "nima orqali?",
        basis: "qoida",
        explanation: `“${words[i]} ${words[i + 1]}” ko‘makchili birikma. Ko‘pincha vositali to‘ldiruvchi bo‘ladi.`,
        alternative: pp === "uchun" ? "Maqsad ma’nosida — maqsad holi; shaxsga qaratilsa — to‘ldiruvchi." : pp === "bilan" ? "Harakat usulini bildirsa — tarz holi bo‘lishi mumkin." : undefined,
        head: k,
      });
      links.push({ from: i, to: k, type: "boshqaruv" });
      continue;
    }
    if (c === "qaratqich kelishigi") {
      // -ning: odatda keyingi egalik qo‘shimchali otni aniqlaydi
      let head = -1;
      for (let j = i + 1; j <= k; j++) if (hasAffix(an[j], /egalik/)) {
        head = j;
        break;
      }
      set(i, {
        role: "aniqlovchi",
        question: "kimning? / nimaning?",
        basis: "qoida",
        explanation: head >= 0 ? `Qaratqich aniqlovchi: “${words[head]}” so‘ziga (egalik qo‘shimchali) tobe.` : "Qaratqich kelishigidagi so‘z odatda qaratqich aniqlovchi bo‘ladi.",
        head: head >= 0 ? head : undefined,
      });
      if (head >= 0) links.push({ from: i, to: head, type: "moslashuv" });
      continue;
    }
    if (c === "tushum kelishigi") {
      set(i, { role: "to‘ldiruvchi", question: "kimni? / nimani?", basis: "qoida", explanation: "Tushum kelishigidagi so‘z — vositasiz to‘ldiruvchi; kesimga boshqaruv yo‘li bilan bog‘lanadi.", head: k });
      links.push({ from: i, to: k, type: "boshqaruv" });
      continue;
    }
    if (c && /jo‘nalish|o‘rin-payt|chiqish/.test(c)) {
      const place = PLACE_HINT.test(key) || TIME_WORDS.has(a?.rootKey ?? "");
      const q = /jo‘nalish/.test(c) ? ["kimga? nimaga?", "qayerga?"] : /chiqish/.test(c) ? ["kimdan? nimadan?", "qayerdan?"] : ["kimda? nimada?", "qayerda? qachon?"];
      set(i, {
        role: place ? "hol" : "to‘ldiruvchi",
        question: place ? q[1] : q[0],
        basis: "taxmin",
        explanation: place
          ? "Joy yoki vaqtni bildiruvchi so‘z — o‘rin/payt holi bo‘lishi ehtimoli yuqori."
          : "Vositali to‘ldiruvchi bo‘lishi mumkin: harakat kimga/nimaga qaratilganini bildiradi.",
        alternative: place ? `Agar “${q[0]}” so‘rog‘iga javob bo‘lsa — vositali to‘ldiruvchi.` : `Agar “${q[1]}” so‘rog‘iga javob bo‘lsa — o‘rin yoki payt holi.`,
        head: k,
      });
      links.push({ from: i, to: k, type: "boshqaruv" });
      continue;
    }
    if (TIME_WORDS.has(key) || hasAffix(a, /ravishdosh/) || (MANNER_WORDS.has(key) && next === k) || pos[i] === "ravish") {
      set(i, {
        role: "hol",
        question: TIME_WORDS.has(key) ? "qachon?" : hasAffix(a, /ravishdosh/) ? "qanday qilib? / qachon?" : "qanday? / qay tarzda?",
        basis: TIME_WORDS.has(key) || pos[i] === "ravish" ? "lug‘at" : "qoida",
        explanation: TIME_WORDS.has(key) ? "Payt ma’nosidagi so‘z — payt holi." : hasAffix(a, /ravishdosh/) ? "Ravishdosh shakli — odatda hol vazifasida keladi." : "Harakatning belgisini bildiradi — tarz holi.",
        head: k,
      });
      links.push({ from: i, to: k, type: "bitishuv" });
      continue;
    }
    const nextIsNoun = next >= 0 && next !== k ? !["fe’l", "ko‘makchi"].includes(pos[next] ?? "") : next === k && !verbal;
    if ((DEMONSTRATIVES.has(key) && !PRONOUNS.has(key)) || ((pos[i] === "sifat" || pos[i] === "son" || hasAffix(a, /sifat yasovchi|sifatdosh/)) && nextIsNoun)) {
      set(i, {
        role: "aniqlovchi",
        question: "qanday? / qaysi? / nechta?",
        basis: pos[i] === "sifat" ? "lug‘at" : "qoida",
        explanation: `Keyingi “${words[next]}” so‘zining belgisini bildiradi — sifatlovchi aniqlovchi (bitishuv aloqasi).`,
        head: next,
      });
      links.push({ from: i, to: next, type: "bitishuv" });
      continue;
    }
  }

  // 3. Ega: bosh kelishikdagi ot/olmosh, kesim bilan shaxs-sonda mos keladi
  let egaIndex = -1;
  for (let i = 0; i < k; i++) {
    if (roles[i].role !== "noma’lum" || POSTPOSITIONS.has(keys[i])) continue;
    if (caseOf(an[i]) || pos[i] === "fe’l") continue;
    const nextRole = roles[i + 1];
    if (nextRole && i + 1 < k && pos[i + 1] !== "fe’l" && !caseOf(an[i + 1]) && roles[i + 1].role === "noma’lum" && !PRONOUNS.has(keys[i])) continue;
    egaIndex = i;
    break;
  }
  if (egaIndex >= 0) {
    const pr = PRONOUNS.get(keys[egaIndex]);
    const agrees = pr && kesimPerson ? kesimPerson.startsWith(pr[0]) : null;
    set(egaIndex, {
      role: "ega",
      question: "kim? / nima?",
      basis: PRONOUNS.has(keys[egaIndex]) ? "lug‘at" : "qoida",
      explanation:
        "Bosh kelishikdagi ot yoki olmosh — ega. " +
        (agrees === true ? "Kesim bilan shaxs-sonda moslashgan." : agrees === false ? "Diqqat: kesimdagi shaxs qo‘shimchasi bilan mos emas." : "Kesim bilan predikativ aloqada."),
      head: k,
    });
    links.push({ from: egaIndex, to: k, type: "predikativ" });
    // Egadan oldingi qolgan so‘zlar — egani aniqlashi mumkin
  } else if (kesimPerson && kesimPerson[0] !== "3") {
    warnings.push("Ega gapda alohida so‘z bilan ifodalanmagan; u kesimdagi shaxs qo‘shimchasidan anglashiladi (yashirin ega).");
  }

  // 4a. Fe’l kesim oldidagi qo‘shimchasiz ot — belgisiz tushum kelishigidagi to‘ldiruvchi (xat yozdim)
  if (verbal && k > 0 && roles[k - 1].role === "noma’lum" && !caseOf(an[k - 1]) && !POSTPOSITIONS.has(keys[k - 1]) && pos[k - 1] !== "fe’l") {
    set(k - 1, {
      role: "to‘ldiruvchi",
      question: "nimani? (belgisiz)",
      basis: "taxmin",
      explanation: "Fe’l kesim oldidagi qo‘shimchasiz ot ko‘pincha belgisiz tushum kelishigidagi vositasiz to‘ldiruvchi bo‘ladi.",
      alternative: "Agar harakatni bajaruvchini bildirsa — ega.",
      head: k,
    });
    links.push({ from: k - 1, to: k, type: "boshqaruv" });
  }

  // 4. Qolgan noaniq otlar: keyingi otni aniqlashi yoki to‘ldiruvchi bo‘lishi mumkin
  for (const r of roles) {
    if (r.role !== "noma’lum" || POSTPOSITIONS.has(keys[r.index])) continue;
    const nxt = r.index + 1;
    if (nxt <= k && roles[nxt] && ["ega", "to‘ldiruvchi", "hol", "aniqlovchi"].includes(roles[nxt].role) && pos[nxt] !== "fe’l") {
      set(r.index, {
        role: "aniqlovchi",
        question: "qanday? / qaysi?",
        basis: "taxmin",
        explanation: `Keyingi “${words[nxt]}” so‘ziga bog‘lanib, uning belgisini bildirishi mumkin.`,
        head: nxt,
        alternative: "Agar mustaqil ma’no bildirsa, boshqa gap bo‘lagi bo‘lishi mumkin.",
      });
      links.push({ from: r.index, to: nxt, type: "bitishuv" });
    }
  }

  if (roles.some((r) => r.basis === "taxmin")) warnings.push("“Taxmin” belgili natijalar gapdagi ma’noga qarab o‘zgarishi mumkin — so‘roq berib tekshiring.");
  return { words, roles, links, warnings };
}
