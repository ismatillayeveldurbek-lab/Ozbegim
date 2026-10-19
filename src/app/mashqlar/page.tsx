import { Exercises } from "@/components/exercises/Exercises";
import { RequireLogin } from "@/components/RequireLogin";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Mashqlar" };

export default function Page() {
  return (
    <>
      <PageIntro title="Mashqlar">Har bir javobdan keyin tushuntirish beriladi; natijalar va xatolaringiz saqlanadi.</PageIntro>
      <RequireLogin what="Mashqlar natijasini saqlash">
        <Exercises />
      </RequireLogin>
    </>
  );
}
