import { SCALES, type Scale } from "@/ai/tasks/opportunity-search";
import type { Messages } from "@/i18n/dictionaries";
import { fill, formatDate } from "@/i18n/format";
import type { FoundOpportunity } from "./data";

type Copy = Messages["explore"];
/** The three-step principle: a few clear places to start, everything else folded away by scale. */
const BEST = 3;

export function Results({ results, foundOn, place, lang, demo, copy }: {
  results: FoundOpportunity[]; foundOn: string; place: string; lang: string; demo: boolean; copy: Copy;
}) {
  const best = results.slice(0, BEST);
  const rest = results.slice(BEST);
  const byScale = SCALES.map((scale) => [scale, rest.filter((r) => r.scale === scale)] as const).filter(([, list]) => list.length);

  return (
    <div className="flex flex-col gap-6">
      {demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}
      <p className="rounded-xl bg-sky/60 p-4 text-sm text-ink">
        {fill(copy.foundOn, { date: formatDate(foundOn, lang), place: place ? fill(copy.around, { place }) : "" })}
      </p>
      {results.length === 0 ? (
        <p>{copy.none}</p>
      ) : (
        <>
          <section aria-labelledby="best-title" className="flex flex-col gap-3">
            <div>
              <h2 id="best-title" className="text-xl font-semibold">{copy.bestTitle}</h2>
              <p className="text-sm text-text-muted">{copy.bestHint}</p>
            </div>
            <ul className="flex flex-col gap-4">
              {best.map((r) => <li key={r.id}><ResultCard item={r} lang={lang} copy={copy} /></li>)}
            </ul>
          </section>
          {byScale.length > 0 && (
            <section aria-labelledby="more-title" className="flex flex-col gap-3">
              <h2 id="more-title" className="text-xl font-semibold">{copy.moreTitle}</h2>
              {byScale.map(([scale, list]) => (
                <details key={scale} className="rounded-xl border border-border">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 p-4 font-semibold">
                    {copy.scales[scale as Scale]}
                    <span className="rounded-full bg-surface-muted px-3 py-0.5 text-sm font-normal">{fill(copy.count, { n: String(list.length) })}</span>
                  </summary>
                  <ul className="flex flex-col gap-4 border-t border-border p-4">
                    {list.map((r) => <li key={r.id}><ResultCard item={r} lang={lang} copy={copy} /></li>)}
                  </ul>
                </details>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ResultCard({ item, lang, copy }: { item: FoundOpportunity; lang: string; copy: Copy }) {
  const titleId = `found-${item.id}`;
  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-5">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-oat px-3 py-0.5 text-ink">{copy.scales[item.scale]}</span>
        <span className="rounded-full bg-lilac px-3 py-0.5 text-ink" title={copy.complexityNote}>
          {copy.complexity[item.complexity]}
          <span className="sr-only"> ({copy.complexityNote})</span>
        </span>
      </div>
      <div>
        <h3 id={titleId} className="text-lg font-semibold">{item.title}</h3>
        {item.funder && <p className="text-text-muted">{fill(copy.from, { funder: item.funder })}</p>}
      </div>
      {item.summary && <p>{item.summary}</p>}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {item.amount && (<><dt className="text-sm font-semibold">{copy.amount}</dt><dd>{item.amount}</dd></>)}
        {item.whoFor && (<><dt className="text-sm font-semibold">{copy.whoFor}</dt><dd>{item.whoFor}</dd></>)}
      </dl>
      <p className="font-medium">
        {item.deadline ? fill(copy.closes, { date: formatDate(item.deadline, lang) }) : item.deadlineNote || copy.checkDeadline}
      </p>
      {item.complexityReason && (
        <p className="text-sm text-text-muted">{copy.complexity[item.complexity]}: {item.complexityReason} ({copy.complexityNote})</p>
      )}
      {item.fit && (
        <div className="rounded-lg bg-paper p-3">
          <p className="text-sm font-semibold">{copy.fit} <span className="font-normal text-text-muted">({copy.fitNote})</span></p>
          <p className="mt-1">{item.fit}</p>
        </div>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="self-start font-medium underline underline-offset-4">
        {copy.source} <span aria-hidden="true">↗</span><span className="sr-only"> {copy.opensNewTab}</span>
      </a>
    </article>
  );
}
