import { Suspense } from "react";
import { LoanwordSearch } from "@/components/dictionary/LoanwordSearch";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "O‘zlashma so‘zlar" };

export default function Page() {
  return (
    <>
      <PageIntro title="O‘zlashma so‘zlar va o‘zbekcha muqobillar">
        Muqobil (o‘rnida ishlatsa bo‘ladigan so‘z) va izoh (ma’nosi) alohida ko‘rsatiladi. Har bir so‘zning majburiy muqobili bo‘lmasligi mumkin.
      </PageIntro>
      <Suspense>
        <LoanwordSearch />
      </Suspense>
    </>
  );
}
