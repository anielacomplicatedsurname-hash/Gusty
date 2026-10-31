import type { ReactNode } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import type { Messages } from "@/i18n/dictionaries";
import { fill, formatDate } from "@/i18n/format";
import type { IdeaSummary } from "./data";
import { RefreshSummary } from "./RefreshSummary";

/**
 * "Your idea, as it stands": one living picture of the idea. Gusty's neat summary of everything said so far,
 * any updates Gusty suggests from finished steps, the key facts ("Here's what I understood"), and the
 * person's own words folded underneath (never changed by Gusty).
 */
export function IdeaSummarySection({ summary, projectId, lang, copy, original, suggestions, reading }: {
  summary: IdeaSummary; projectId: string; lang: string; copy: Messages["ideaSummary"]; original: ReactNode;
  suggestions?: ReactNode; reading?: ReactNode;
}) {
  const has = !!summary.summary;
  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <BrandSymbol name="sprout" size={28} />
        <h2 id="summary-title" className="text-xl font-semibold">{copy.title}</h2>
      </div>

      {has ? (
        <>
          {summary.demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}
          <p className="text-lg leading-relaxed">{summary.summary}</p>
          {summary.points.length > 0 && (
            <div>
              <h3 className="font-semibold">{copy.pointsTitle}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {summary.points.map((p) => (
                  <li key={p} className="flex items-start gap-2"><span aria-hidden="true">✦</span>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-text-muted">{fill(copy.label, { date: formatDate(summary.updatedAt!, lang) })}</p>
          {summary.stale && (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-oat p-3">
              <p className="text-sm">{copy.stale}</p>
              <RefreshSummary projectId={projectId} lang={lang} auto={false} copy={copy} />
            </div>
          )}
        </>
      ) : summary.ready ? (
        <RefreshSummary projectId={projectId} lang={lang} auto copy={copy} />
      ) : (
        <p className="text-text-muted">{copy.notYet}</p>
      )}

      {suggestions}
      {reading}

      <details open={!has} className="rounded-xl border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">{copy.originalTitle}</summary>
        <div className="border-t border-border p-4">
          <p className="mb-3 text-sm text-text-muted">{copy.originalHint}</p>
          {original}
        </div>
      </details>
    </section>
  );
}
