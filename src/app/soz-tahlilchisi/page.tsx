import { WordAnalyzer } from "@/components/word-analyzer/WordAnalyzer";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "So‘z tahlilchisi" };

export default function Page() {
  return (
    <>
      <PageIntro title="So‘z tahlilchisi">So‘zning ma’nosi, sinonim va antonimlari, misollar va so‘z turkumi.</PageIntro>
      <WordAnalyzer />
    </>
  );
}
