import { Analyzer } from "@/components/analysis/Analyzer";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "So‘z va gap tahlili" };

export default function Page() {
  return (
    <>
      <PageIntro title="So‘z va gap tahlili">So‘z tarkibi, bo‘g‘inlar, harf-tovush tahlili va gap bo‘laklari.</PageIntro>
      <Analyzer />
    </>
  );
}
