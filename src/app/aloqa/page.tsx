import { Suspense } from "react";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";
import { RequireLogin } from "@/components/RequireLogin";
import { PageIntro, Spinner } from "@/components/ui/primitives";

export const metadata = { title: "Murojaatlar" };

export default function Page() {
  return (
    <>
      <PageIntro title="Murojaatlar">Saytdagi kamchilik, shikoyat, taklif yoki savolingizni yozing — administratorlar shu yerda javob beradi.</PageIntro>
      <RequireLogin what="Murojaat yuborish">
        <Suspense fallback={<Spinner />}>
          <FeedbackCenter />
        </Suspense>
      </RequireLogin>
    </>
  );
}
