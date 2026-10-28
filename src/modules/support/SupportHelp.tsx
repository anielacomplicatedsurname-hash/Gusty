import { supportContact } from "@/config/support";
import { fill } from "@/i18n/format";
import type { Messages } from "@/i18n/dictionaries";

/** How to stop monthly support or get a refund. Shown on the support and thank-you pages. */
export function SupportHelp({
  copy,
  manageHref,
  stacked = false,
}: {
  copy: Messages["support"];
  manageHref: string | null;
  /** One card under the other, for narrow layouts like the support page. */
  stacked?: boolean;
}) {
  const h = copy.help;
  const [refundBefore, refundAfter] = fill(h.refund, { days: String(supportContact.refundDays) }).split("{email}");
  const mailto = `mailto:${supportContact.email}?subject=${encodeURIComponent("Refund for my Gusty support")}`;

  return (
    <section id="help" aria-labelledby="support-help-title" className="w-full">
      <h2 id="support-help-title" className="text-2xl font-semibold">
        {h.title}
      </h2>
      <div className={`mt-5 grid gap-4 ${manageHref && !stacked ? "md:grid-cols-2" : ""}`}>
        {manageHref && (
          <article className="flex flex-col rounded-(--radius-card) bg-surface-raised p-6">
            <h3 className="text-lg font-semibold">{h.monthlyTitle}</h3>
            <p className="mt-2 font-medium">{h.monthlyLead}</p>
            <p className="mt-2 text-text-muted">{h.monthly}</p>
            <div className="mt-auto pt-5">
              <a href={manageHref} className="btn-secondary">
                {h.monthlyButton}
              </a>
            </div>
          </article>
        )}
        <article className="flex flex-col rounded-(--radius-card) bg-surface-raised p-6">
          <h3 className="text-lg font-semibold">{h.refundTitle}</h3>
          <p className="mt-2">
            {refundBefore}
            <a href={mailto} className="font-medium underline underline-offset-4">
              {supportContact.email}
            </a>
            {refundAfter}
          </p>
          <p className="mt-2 text-text-muted">{h.refundDetail}</p>
          <div className="mt-auto pt-5">
            <a href={mailto} className="btn-secondary">
              {h.refundButton}
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
