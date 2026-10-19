import { Suspense } from "react";
import { IdiomSearch } from "@/components/dictionary/IdiomSearch";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Iboralar ma’nosi" };

export default function Page() {
  return (
    <>
      <PageIntro title="Iboralar ma’nosi">Iboraning tushunarli ma’nosi, qo‘llanish misoli, ma’nodoshlari va manbasi.</PageIntro>
      <Suspense>
        <IdiomSearch />
      </Suspense>
    </>
  );
}
