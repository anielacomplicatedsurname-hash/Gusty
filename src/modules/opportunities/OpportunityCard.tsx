import type { Messages } from "@/i18n/dictionaries";
import { fill, formatDate } from "@/i18n/format";
import type { Opportunity } from "./data";

/** One checked opportunity: what it is, who it's for, when it closes, and where the details come from. */
export function OpportunityCard({ item, lang, copy }: { item: Opportunity; lang: string; copy: Messages["explore"] }) {
  const titleId = `opp-${item.id}`;
  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <h2 id={titleId} className="text-xl font-semibold">{item.title}</h2>
        {item.funder && <p className="text-text-muted">{copy.funder} {item.funder}</p>}
      </div>
      {item.summary && <p>{item.summary}</p>}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {item.amount && (
          <>
            <dt className="text-sm font-semibold">{copy.amount}</dt>
            <dd>{item.amount}</dd>
          </>
        )}
        {item.whoFor && (
          <>
            <dt className="text-sm font-semibold">{copy.whoFor}</dt>
            <dd>{item.whoFor}</dd>
          </>
        )}
        {item.regions.length > 0 && (
          <>
            <dt className="text-sm font-semibold">{copy.where}</dt>
            <dd>{item.regions.map((r) => copy.regions[r]).join(", ")}</dd>
          </>
        )}
      </dl>
      <p className="font-medium">
        {item.deadline ? fill(copy.closes, { date: formatDate(item.deadline, lang) }) : item.deadlineNote || copy.noDate}
      </p>
      <div className="flex flex-col gap-1 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
          {copy.source} <span aria-hidden="true">↗</span>
          <span className="sr-only"> {copy.opensNewTab}</span>
        </a>
        <p className="text-sm text-text-muted">{fill(copy.checked, { date: formatDate(item.checkedAt, lang) })}</p>
      </div>
    </article>
  );
}
