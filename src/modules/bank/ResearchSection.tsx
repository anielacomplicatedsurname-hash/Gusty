"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { fill, formatDate } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { removeEvidence, startResearch } from "./actions";
import type { Bank, Source } from "./data";

type Copy = typeof en.bank;

/** Research Gusty found online, each with its source, and a way to look for more within a small allowance. */
export function ResearchSection({ sources, state, projectId, lang, copy }: {
  sources: Source[]; state: Bank["researchState"]; projectId: string; lang: string; copy: Copy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // While a search runs on the server, look again every few seconds.
  useEffect(() => {
    if (!state.running) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [state.running, router]);

  const search = () =>
    start(async () => {
      setError(null);
      const result = await startResearch(projectId, lang);
      if (result.ok) router.refresh();
      else if (result.error === "limitProject") setError(copy.researchLimitProject);
      else if (result.error === "limitPerson") setError(fill(copy.researchLimitPerson, { max: String(state.max) }));
      else setError(copy.researchErrors[result.error]);
    });

  return (
    <section aria-labelledby="research-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <BrandSymbol name="spark" size={28} />
            <h2 id="research-title" className="type-heading">{copy.researchTitle}</h2>
          </div>
          <p className="rounded-full bg-oat px-3 py-0.5 text-sm text-ink">
            {fill(copy.researchAllowance, { n: String(state.left), max: String(state.max) })}
          </p>
        </div>
        <p className="mt-1 text-sm text-text-muted">{copy.researchIntro}</p>
      </div>

      {state.demo && sources.length > 0 && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}
      {sources.length === 0 && !state.running && <p className="text-text-muted">{copy.researchNone}</p>}
      {sources.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <h3 className="font-semibold">
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{s.title}</a>
              </h3>
              {(s.publisher || s.year) && <p className="text-sm text-text-muted">{[s.publisher, s.year].filter(Boolean).join(" · ")}</p>}
              <p>{s.finding}</p>
              {s.relevance && (
                <p className="text-sm">
                  <span className="font-semibold">{copy.whyItHelps}</span> {s.relevance}{" "}
                  <span className="rounded-full bg-lilac px-2 py-0.5 text-xs font-medium text-ink">{copy.gustysLink}</span>
                </p>
              )}
              <p className="text-sm text-text-muted">{fill(copy.foundBy, { date: s.foundAt ? formatDate(s.foundAt, lang) : "" })}</p>
              <div className="flex flex-wrap gap-x-4 text-sm font-medium">
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4"
                  aria-label={`${copy.openSource}: ${s.title}`}>{copy.openSource}</a>
                <button type="button" className="min-h-6 underline underline-offset-4" disabled={pending}
                  aria-label={`${copy.remove}: ${s.title}`}
                  onClick={() => start(async () => { await removeEvidence(s.id); router.refresh(); })}>{copy.remove}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {state.running ? (
        <p role="status" className="flex items-start gap-3 rounded-xl bg-paper p-4">
          <span aria-hidden="true" className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {copy.researchRunning}
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          {state.failed && <p role="status" className="font-medium">{copy.researchFailed}</p>}
          {state.limit ? (
            <p role="status">{state.limit === "project" ? copy.researchLimitProject : fill(copy.researchLimitPerson, { max: String(state.max) })}</p>
          ) : (
            <button type="button" className="btn-secondary" disabled={pending} onClick={search}>
              {pending ? copy.researchStarting : sources.length > 0 ? copy.researchAgain : copy.research}
            </button>
          )}
          <p className="text-sm text-text-muted">{copy.researchWhat} {copy.researchAllowanceProject}</p>
        </div>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </section>
  );
}
