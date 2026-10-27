import { supportContact } from "@/config/support";
import { fill } from "@/i18n/format";
import type { Messages } from "@/i18n/dictionaries";

/** How to stop a monthly contribution or get a refund. Shown on the support and thank-you pages. */
export function SupportHelp({ copy, manageHref }: { copy: Messages["support"]; manageHref: string | null }) {
  const [before, after] = copy.help.monthly.split("{manage}");
  const [refundBefore, refundAfter] = fill(copy.help.refund, { days: String(supportContact.refundDays) }).split("{email}");
  return (
    <section id="help" aria-labelledby="support-help-title" className="rounded-(--radius-card) bg-surface-raised p-6 sm:p-8">
      <h2 id="support-help-title" className="text-xl font-semibold">
        {copy.help.title}
      </h2>
      {manageHref && (
        <>
          <h3 className="mt-4 font-semibold">{copy.help.monthlyTitle}</h3>
          <p className="mt-1 text-text-muted">
            {before}
            <a href={manageHref} className="font-medium text-ink underline underline-offset-4">
              {copy.manage}
            </a>
            {after}
          </p>
        </>
      )}
      <h3 className="mt-4 font-semibold">{copy.help.refundTitle}</h3>
      <p className="mt-1 text-text-muted">
        {refundBefore}
        <a href={`mailto:${supportContact.email}`} className="font-medium text-ink underline underline-offset-4">
          {supportContact.email}
        </a>
        {refundAfter}
      </p>
      <p className="mt-4 text-sm text-text-muted">{copy.help.receipt}</p>
    </section>
  );
}
