import {
  Activity,
  ArrowLeftRight,
  BookA,
  BookMarked,
  ChartNoAxesColumn,
  GraduationCap,
  History,
  Languages,
  House,
  Microscope,
  Quote,
  Replace,
  ScrollText,
  ShieldCheck,
  SpellCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description?: string;
}

/** Asosiy to‘rtta vosita — bosh sahifada va mobil navigatsiyada birinchi o‘rinda. */
export const MAIN_NAV: NavItem[] = [
  {
    href: "/konvertor",
    label: "Lotin ↔ Kirill",
    short: "Konvertor",
    icon: ArrowLeftRight,
    description: "Matn va fayllarni lotin va kirill yozuvlari orasida o‘giring.",
  },
  {
    href: "/iboralar",
    label: "Iboralar ma’nosi",
    short: "Iboralar",
    icon: Quote,
    description: "Iboralarning ma’nosi, misollari va ma’nodoshlarini toping.",
  },
  {
    href: "/imlo",
    label: "Imlo tekshiruvi",
    short: "Imlo",
    icon: SpellCheck,
    description: "Matndagi imlo, bo‘shliq va yozilish xatolarini aniqlang.",
  },
  {
    href: "/ozlashma",
    label: "O‘zlashma so‘zlar",
    short: "O‘zlashma",
    icon: Replace,
    description: "O‘zlashma so‘zlarning o‘zbekcha muqobillari va izohlari.",
  },
];

export const EXTRA_NAV: NavItem[] = [
  { href: "/tahlil", label: "So‘z va gap tahlili", short: "Tahlil", icon: Microscope, description: "So‘z tarkibi, bo‘g‘inlar va gap bo‘laklari." },
  { href: "/soz-tahlilchisi", label: "So‘z tahlilchisi", short: "Tahlilchi", icon: BookA, description: "Ma’no, sinonim, antonim, misol va so‘z turkumi." },
  { href: "/tarjima", label: "Turistlar uchun tarjimon", short: "Tarjimon", icon: Languages, description: "Istalgan tildagi matnni o‘zbek tiliga tarjima." },
  { href: "/lugatim", label: "Shaxsiy lug‘at", short: "Lug‘atim", icon: BookMarked, description: "Saqlangan so‘z va iboralaringiz." },
  { href: "/mashqlar", label: "Mashqlar", short: "Mashqlar", icon: GraduationCap, description: "Tasdiqlangan ma’lumotlar asosidagi mashqlar va kartochkalar." },
  { href: "/statistika", label: "Matn statistikasi", short: "Statistika", icon: ChartNoAxesColumn, description: "Belgilar, so‘zlar, gaplar va yozuv tarkibi." },
  { href: "/tarix", label: "Ish tarixi", short: "Tarix", icon: History, description: "Roziligingiz bilan saqlangan ishlar." },
  { href: "/holat", label: "Imkoniyatlar holati", short: "Holat", icon: Activity, description: "Qaysi formatlar va xizmatlar ishlayotgani." },
  { href: "/qoidalar", label: "O‘girish qoidalari", short: "Qoidalar", icon: ScrollText, description: "Transliteratsiya qoidalari va cheklovlari." },
];

export const HOME_NAV: NavItem = { href: "/", label: "Bosh sahifa", short: "Bosh sahifa", icon: House };
export const ADMIN_NAV: NavItem = { href: "/admin", label: "Admin paneli", short: "Admin", icon: ShieldCheck };

const TITLES: Array<[string, string]> = [
  ["/konvertor/fayl", "Faylni o‘girish"],
  ["/admin", "Admin paneli"],
  ["/kirish", "Kirish"],
  ["/royxat", "Ro‘yxatdan o‘tish"],
  ["/profil", "Profil va sozlamalar"],
  ["/qidiruv", "Qidiruv natijalari"],
  ...[...MAIN_NAV, ...EXTRA_NAV].map((n) => [n.href, n.label] as [string, string]),
];

export function titleFor(pathname: string): string {
  if (pathname === "/") return "Bosh sahifa";
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit?.[1] ?? "O‘zbegim";
}
