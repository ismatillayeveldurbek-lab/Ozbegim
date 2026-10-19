import { PersonalDictionary } from "@/components/personal/PersonalDictionary";
import { RequireLogin } from "@/components/RequireLogin";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Shaxsiy lug‘at" };

export default function Page() {
  return (
    <>
      <PageIntro title="Shaxsiy lug‘at">Saqlangan so‘z va iboralaringiz, papkalar, teglar va qaydlar.</PageIntro>
      <RequireLogin what="Shaxsiy lug‘at">
        <PersonalDictionary />
      </RequireLogin>
    </>
  );
}
