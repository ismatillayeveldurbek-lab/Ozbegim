import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui/primitives";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentUser, isAdmin, isStaff } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin paneli" };

/** Server tomonida rol tekshiruvi. API’lar ham alohida tekshiradi. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user)
    return (
      <Notice kind="warn" title="Kirish talab qilinadi">
        Admin paneliga kirish uchun{" "}
        <Link href="/kirish?next=/admin" className="underline">
          tizimga kiring
        </Link>
        .
      </Notice>
    );
  if (!isStaff(user))
    return (
      <Notice kind="danger" title="Ruxsat yo‘q">
        Bu bo‘lim faqat moderator va administratorlar uchun.
      </Notice>
    );
  return (
    <div className="flex flex-col gap-5">
      <AdminNav admin={isAdmin(user)} />
      {children}
    </div>
  );
}
