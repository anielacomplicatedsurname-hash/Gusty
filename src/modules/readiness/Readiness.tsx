import Link from "next/link";
import { BrandSymbol } from "@/components/BrandSymbol";
import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { AREAS, type Area, type Readiness } from "./data";
import { NeedPicker } from "./NeedPicker";
import { SuggestRoutes } from "./SuggestRoutes";
import { AddRouteStep } from "./AddRouteStep";

/** Where each area that isn't in place yet points: the part of the page (or Explore) that does it. */
const HREF: Record<Area, (project: string, explore: string) => string> = {
  clear: (p) => `${p}?tab=idea#reading-title`,
  who: (p) => `${p}?tab=idea#reading-title`,
  where: (p) => `${p}?tab=idea#reading-title`,
  amount: () => "#need",
  plan: (p) => `${p}?tab=plan#steps-title`,
  progress: (p) => `${p}?tab=plan#steps-title`,
  opportunities: (_, explore) => explore,
};

/** "Ready for funding": what's in place, up to three next things, the amount needed, and Gusty's routes. */
export function ReadinessSection({ readiness, projectId, lang, copy }: {
  readiness: Readiness; projectId: string; lang: string; copy: Messages["readiness"];
}) {
  const total = AREAS.length;
  const done = AREAS.filter((a) => readiness.inPlace[a]).length;
  const explore = `/${lang}/explore?project=${projectId}`;
  const countText = fill(copy.count, { n: String(done), total: String(total) });

  return (
    <section aria-labelledby="readiness-title" className="flex flex-col gap-6 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          <BrandSymbol name="sprout" size={28} />
          <h2 id="readiness-title" className="type-heading">{copy.title}</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">{copy.intro}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div role="progressbar" aria-label={copy.progressLabel} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
          aria-valuetext={countText} className="h-3 w-full overflow-hidden rounded-full bg-oat">
          <div className="h-full rounded-full bg-ink motion-safe:transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="text-sm font-medium">{countText}</p>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {AREAS.map((a) => (
            <li key={a} className="flex min-h-6 items-center gap-2">
              <span aria-hidden="true">{readiness.inPlace[a] ? "✓" : "○"}</span>
              {readiness.inPlace[a] ? (
                <>{copy.areas[a]}<span className="sr-only">: {copy.inPlace}</span></>
              ) : (
                // Each missing piece links straight to where it's done: no separate list to read.
                <Link href={HREF[a](`/${lang}/projects/${projectId}`, explore)} className="inline-flex min-h-6 items-center text-text-muted underline underline-offset-4 hover:text-ink">
                  {copy.areas[a]}<span className="sr-only">: {copy.notYet}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>

      {done === total && <p className="rounded-xl bg-confirmed/60 p-3 text-ink">{copy.allInPlace}</p>}

      <NeedPicker projectId={projectId} initial={readiness.need} copy={copy} />

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <h3 className="font-semibold">{copy.routesTitle}</h3>
          <p className="text-sm text-text-muted">{copy.routesIntro}</p>
        </div>
        {readiness.demo && readiness.routes.length > 0 && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}
        {readiness.routes.length > 0 && (
          <ol className="flex flex-col gap-3">
            {readiness.routes.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-lilac px-3 py-0.5 text-ink">{copy.fit[r.fit]}</span>
                  <span className="rounded-full bg-oat px-3 py-0.5 text-ink">{copy.focus[r.focus]}</span>
                  <span className="text-text-muted">{copy.estimate}</span>
                </div>
                <h4 className="text-lg font-semibold">{copy.routes[r.route]}</h4>
                {r.why && <p>{r.why}</p>}
                {r.firstStep && <p className="text-sm"><span className="font-semibold">{copy.firstStep}:</span> {r.firstStep}</p>}
                <AddRouteStep id={r.id} title={copy.routes[r.route]} lang={lang} copy={copy} />
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <SuggestRoutes projectId={projectId} lang={lang} again={readiness.routes.length > 0} copy={copy} />
          {readiness.routes.length > 0 && (
            <Link href={explore} className="font-medium underline underline-offset-4">{copy.findThese}</Link>
          )}
        </div>
      </div>
    </section>
  );
}
