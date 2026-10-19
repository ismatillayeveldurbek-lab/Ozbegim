"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Notice, Spinner } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

export function RequireLogin({ children, what }: { children: ReactNode; what: string }) {
  const { data, isPending } = authClient.useSession();
  const pathname = usePathname();
  if (isPending) return <Spinner />;
  if (!data)
    return (
      <Notice kind="info" title="Tizimga kiring">
        {what} uchun hisob kerak.{" "}
        <Link href={`/kirish?next=${encodeURIComponent(pathname)}`} className="font-semibold underline">
          Kirish
        </Link>{" "}
        yoki{" "}
        <Link href={`/royxat?next=${encodeURIComponent(pathname)}`} className="font-semibold underline">
          ro‘yxatdan o‘tish
        </Link>
        .
      </Notice>
    );
  return <>{children}</>;
}
