import { ProfileSettings } from "@/components/personal/ProfileSettings";
import { RequireLogin } from "@/components/RequireLogin";
import { PageIntro } from "@/components/ui/primitives";

export const metadata = { title: "Profil va sozlamalar" };

export default function Page() {
  return (
    <>
      <PageIntro title="Profil va sozlamalar" />
      <RequireLogin what="Profil">
        <ProfileSettings />
      </RequireLogin>
    </>
  );
}
