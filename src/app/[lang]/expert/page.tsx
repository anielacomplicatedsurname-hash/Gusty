import type { Metadata } from "next";
import { BrandSymbol } from "@/components/BrandSymbol";
import { EXPERT } from "@/config/expert";
import { getMessages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.expert.title, description: t.expert.description };
}

/** A 1:1 call with Gusty's founder about an idea or its funding, booked on Calendly. */
export default async function ExpertPage() {
  const t = await getMessages();
  const e = t.expert;
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
      <div>
        <p className="text-sm text-text-muted">{e.label}</p>
        <h1 className="type-display mt-2 text-5xl sm:text-6xl">{e.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-text-muted">{e.lead}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-6">
        <div className="flex items-center gap-3">
          <BrandSymbol name="open-hands" size={32} />
          <h2 className="text-xl font-semibold">{e.whatTitle}</h2>
        </div>
        <ul className="flex flex-col gap-2">
          {e.what.map((item) => (
            <li key={item} className="flex items-start gap-2"><span aria-hidden="true">→</span>{item}</li>
          ))}
        </ul>
        <p className="text-lg font-semibold">{fill(e.fee, { fee: EXPERT.fee })}</p>
        <p className="text-sm text-text-muted">{e.feeNote}</p>
        <div className="flex flex-wrap items-center gap-4">
          <a href={EXPERT.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {e.book}<span className="sr-only"> {e.opensCalendly}</span>
          </a>
          <a href={EXPERT.aboutUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
            {e.about}<span className="sr-only"> {e.opensNewTab}</span>
          </a>
        </div>
        <p className="text-sm text-text-muted">{e.privacy}</p>
      </div>
    </section>
  );
}
