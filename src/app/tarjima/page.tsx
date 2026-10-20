import { TouristTranslator } from "@/components/tourist-translator/TouristTranslator";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Turistlar uchun tarjimon" };

export default function Page() {
  return (
    <>
      <PageIntro title="Turistlar uchun tarjimon">Xalqaro mehmonlar istalgan tilda yozgan matnni o‘zbek tiliga tarjima qiling.</PageIntro>
      <TouristTranslator />
    </>
  );
}
