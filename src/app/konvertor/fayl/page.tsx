import { FileConverter } from "@/components/converter/FileConverter";
import { ModeTabs } from "@/components/converter/ModeTabs";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Faylni o‘girish" };

export default function Page() {
  return (
    <>
      <PageIntro title="Lotin ↔ Kirill konvertori">Hujjat tuzilishi va bezaklari imkon qadar saqlangan holda faylni o‘giring.</PageIntro>
      <ModeTabs active="file" />
      <FileConverter />
    </>
  );
}
