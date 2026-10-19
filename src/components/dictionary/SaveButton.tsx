"use client";
import { BookMarked } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/fetcher";

export function SaveButton({ kind, term, meaning, refId }: { kind: "WORD" | "IDIOM" | "LOANWORD"; term: string; meaning?: string | null; refId?: string }) {
  const { data } = authClient.useSession();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  if (!data) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={saved}
      onClick={async () => {
        try {
          await api("/api/personal/items", { method: "POST", json: { kind, term, meaning: meaning ?? undefined, refId } });
          setSaved(true);
          toast.success("Shaxsiy lug‘atga saqlandi.");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <BookMarked className="h-4 w-4" aria-hidden /> {saved ? "Saqlandi" : "Saqlash"}
    </button>
  );
}
