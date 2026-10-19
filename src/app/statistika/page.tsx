import { TextStatsView } from "@/components/stats/TextStatsView";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Matn statistikasi" };

export default function Page() {
  return (
    <>
      <PageIntro title="Matn statistikasi" />
      <TextStatsView />
    </>
  );
}
