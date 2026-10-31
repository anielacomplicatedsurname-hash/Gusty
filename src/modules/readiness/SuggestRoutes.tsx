"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { suggestRoutes } from "./actions";

export function SuggestRoutes({ projectId, lang, again, copy }: {
  projectId: string; lang: string; again: boolean;
  copy: { suggest: string; suggestAgain: string; suggesting: string; errors: Record<string, string> };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={again ? "btn-secondary" : "btn-primary"} disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await suggestRoutes(projectId, lang);
            if (result.ok) router.refresh();
            else setError(copy.errors[result.error]);
          });
        }}>
        {pending ? copy.suggesting : again ? copy.suggestAgain : copy.suggest}
      </button>
      {pending && <p role="status" className="text-sm text-text-muted">{copy.suggesting}</p>}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </div>
  );
}
