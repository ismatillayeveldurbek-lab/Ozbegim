import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EXTRA_NAV, MAIN_NAV } from "@/lib/nav";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="glass relative overflow-hidden p-6 sm:p-10">
        <p className="chip w-fit bg-accent-soft text-accent">O‘zbek tili yordamchisi</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
          O‘zbekcha matn bilan ishlash — tez, aniq va tushunarli.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Lotin va kirill yozuvlari orasida o‘giring, iboralar ma’nosini bilib oling, imloni tekshiring va o‘zlashma so‘zlarning o‘zbekcha
          muqobillarini toping.
        </p>
      </section>

      <section aria-labelledby="main-tools">
        <h2 id="main-tools" className="mb-3 text-xl font-bold">
          Asosiy vositalar
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MAIN_NAV.map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="glass group flex h-full flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5 sm:p-6 animate-rise"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="text-xl font-bold">{item.label}</span>
                  </span>
                  <span className="text-ink-soft">{item.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1.5 font-semibold text-accent">
                    Ochish <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="extra-tools">
        <h2 id="extra-tools" className="mb-3 text-lg font-bold text-ink-soft">
          Qo‘shimcha vositalar
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRA_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 hover:bg-accent-soft">
                  <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block truncate text-sm text-ink-muted">{item.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
