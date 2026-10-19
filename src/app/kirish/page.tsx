import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Kirish" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
