"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type en from "@/i18n/messages/en.json";
import { startSearch } from "./actions";

type Copy = typeof en.explore;

/** Where to search and the button to start, or a calm "searching" note that checks back by itself. */
export function SearchPanel({
  projectId, lang, place: initialPlace, running, failed, limit, hasResults, copy,
}: {
  projectId: string; lang: string; place: string; running: boolean; failed: boolean;
  limit: "project" | "person" | null; hasResults: boolean; copy: Copy;
}) {
  const router = useRouter();
  const [place, setPlace] = useState(initialPlace);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // While a search runs on the server, look again every few seconds.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [running, router]);

  if (running) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-xl bg-surface-raised p-4">
        <span aria-hidden="true" className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
        {copy.running}
      </p>
    );
  }

  const search = () => {
    setError(null);
    startTransition(async () => {
      const result = await startSearch(projectId, place, lang);
      if (result.ok) router.refresh();
      else if (result.error === "limitProject") setError(copy.limitProject);
      else if (result.error === "limitPerson") setError(copy.limitPerson);
      else setError(copy.errors[result.error]);
    });
  };

  return (
    <section aria-label={copy.search} className="flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      {failed && <p role="status" className="font-medium">{copy.failed}</p>}
      {limit ? (
        <p role="status">{limit === "project" ? copy.limitProject : copy.limitPerson}</p>
      ) : (
        <>
          <div>
            <label htmlFor="place" className="block font-medium">{copy.placeLabel}</label>
            <p id="place-hint" className="text-sm text-text-muted">{copy.placeHint}</p>
            <input id="place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120}
              aria-describedby="place-hint" autoComplete="off"
              className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3" />
          </div>
          <p className="text-sm text-text-muted">{copy.searchHint}</p>
          <button type="button" className="btn-primary self-start" disabled={pending} onClick={search}>
            {pending ? copy.starting : hasResults ? copy.searchAgain : copy.search}
          </button>
          <p className="text-sm text-text-muted">{copy.privacy}</p>
        </>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </section>
  );
}
