import { SpellChecker } from "@/components/spelling/SpellChecker";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Imlo tekshiruvi" };

export default function Page() {
  return (
    <>
      <PageIntro title="Imlo tekshiruvi">Har bir tavsiyani qabul qiling yoki rad eting — matningiz ruxsatsiz o‘zgartirilmaydi.</PageIntro>
      <SpellChecker />
    </>
  );
}
