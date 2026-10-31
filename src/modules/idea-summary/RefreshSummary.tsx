"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { refreshSummary } from "./actions";

type Copy = { refresh: string; refreshing: string; writing: string; errors: Record<string, string> };

/** Writes the first summary by itself (once there's something to summarise); later, only when asked. */
export function RefreshSummary({ projectId, lang, auto, copy }: { projectId: string; lang: string; auto: boolean; copy: Copy }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await refreshSummary(projectId, lang);
      if (result.ok) router.refresh();
      else setError(copy.errors[result.error]);
    });
  };

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  if (auto && !error) {
    return (
      <p role="status" className="flex items-center gap-3 text-text-muted">
        <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-lilac motion-safe:animate-pulse" />
        {copy.writing}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className="btn-secondary" disabled={pending} onClick={run}>
        {pending ? copy.refreshing : copy.refresh}
      </button>
      {error && <p role="alert" className="font-medium">{error}</p>}
    </div>
  );
}
