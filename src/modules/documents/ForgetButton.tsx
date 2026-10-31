"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteDocument } from "./actions";

export function ForgetButton({ id, filename, label }: { id: string; filename: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="self-start text-sm font-medium underline underline-offset-4" disabled={pending}
      aria-label={`${label}: ${filename}`}
      onClick={() => startTransition(async () => { if ((await deleteDocument(id)).ok) router.refresh(); })}>
      {label}
    </button>
  );
}
