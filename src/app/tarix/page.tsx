import { HistoryView } from "@/components/personal/HistoryView";
import { RequireLogin } from "@/components/RequireLogin";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Ish tarixi" };

export default function Page() {
  return (
    <>
      <PageIntro title="Ish tarixi">Konvertatsiyalar, imlo tekshiruvlari, saqlangan natijalar va fayl vazifalari.</PageIntro>
      <RequireLogin what="Ish tarixi">
        <HistoryView />
      </RequireLogin>
    </>
  );
}
