import Link from "next/link";
import { ModeTabs } from "@/components/converter/ModeTabs";
import { TextConverter } from "@/components/converter/TextConverter";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Lotin ↔ Kirill" };

export default function Page() {
  return (
    <>
      <PageIntro title="Lotin ↔ Kirill konvertori">
        Matn brauzeringizda o‘giriladi va serverga yuborilmaydi.{" "}
        <Link href="/qoidalar" className="font-semibold text-accent underline">
          O‘girish qoidalari
        </Link>
      </PageIntro>
      <ModeTabs active="text" />
      <TextConverter />
    </>
  );
}
