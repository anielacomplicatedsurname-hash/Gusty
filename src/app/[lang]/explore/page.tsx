import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Region } from "@/ai/tasks/opportunity";
import { AdminLink } from "@/components/AdminLink";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { getPublishedOpportunities } from "@/modules/opportunities/data";
import { OpportunityCard } from "@/modules/opportunities/OpportunityCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.explore.title, description: t.explore.metaDescription };
}

const FILTERS = ["all", "uk", "europe", "international"] as const;
type Filter = (typeof FILTERS)[number];
/** A short first list keeps it calm; the rest is one tap away. */
const FIRST = 6;

export default async function ExplorePage({ params, searchParams }: PageProps<"/[lang]/explore">) {
  const t = await getMessages();
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
      <header className="flex flex-col items-start gap-4">
        <BrandSymbol name="horizon-hill" size={56} />
        <h1 className="type-display text-5xl sm:text-6xl">{t.explore.title}</h1>
        <p className="text-lg">{t.explore.intro}</p>
        <p className="rounded-xl bg-sky/60 p-4 text-sm text-ink">{t.explore.trust}</p>
        <Suspense fallback={null}>
          <ExploreAdminLink params={params} label={t.explore.addOpportunity} />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-text-muted">…</p>}>
        <OpportunityList params={params} searchParams={searchParams} t={t} />
      </Suspense>
      <aside className="rounded-xl border border-dashed border-border p-5">
        <h2 className="font-semibold">{t.explore.comingTitle}</h2>
        <p className="mt-1 text-text-muted">{t.explore.comingBody}</p>
      </aside>
    </section>
  );
}

/** Only the founder (an admin) sees a way in to add opportunities. */
async function ExploreAdminLink({ params, label }: { params: PageProps<"/[lang]/explore">["params"]; label: string }) {
  const { lang } = await params;
  return <AdminLink href={`/${lang}/admin/opportunities`} label={label} className="btn-secondary" />;
}

/** Open to applicants from the chosen area: listed for it, or open worldwide. */
const fits = (regions: Region[], filter: Filter) =>
  filter === "all" || regions.includes(filter) || (filter !== "international" && regions.includes("international"));

async function OpportunityList({
  params, searchParams, t,
}: {
  params: PageProps<"/[lang]/explore">["params"]; searchParams: PageProps<"/[lang]/explore">["searchParams"]; t: Messages;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const filter: Filter = FILTERS.includes(query.region as Filter) ? (query.region as Filter) : "all";
  const showAll = query.more === "1";
  const all = await getPublishedOpportunities();
  if (all === null) return <p role="status">{t.explore.unavailable}</p>;

  const items = all.filter((o) => fits(o.regions, filter));
  const shown = showAll ? items : items.slice(0, FIRST);
  const href = (f: Filter, more = false) => {
    const q = new URLSearchParams();
    if (f !== "all") q.set("region", f);
    if (more) q.set("more", "1");
    const s = q.toString();
    return `/${lang}/explore${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {all.length > 0 && (
        <nav aria-label={t.explore.filterLabel} className="flex flex-wrap items-center gap-2">
          <span className="type-label mr-1 text-text-muted">{t.explore.filterLabel}</span>
          {FILTERS.map((f) => (
            <Link key={f} href={href(f)} aria-current={f === filter ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
                f === filter ? "border-ink bg-ink text-paper" : "border-border bg-paper text-ink"
              }`}>
              {t.explore.regions[f]}
            </Link>
          ))}
        </nav>
      )}
      {items.length > 0 && (
        <p className="text-sm text-text-muted" role="status">
          {items.length === 1 ? t.explore.oneCount : fill(t.explore.count, { n: String(items.length) })}
        </p>
      )}
      {items.length === 0 ? (
        <p>{all.length === 0 ? t.explore.empty : t.explore.emptyFilter}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((o) => (
            <li key={o.id}><OpportunityCard item={o} lang={lang} copy={t.explore} /></li>
          ))}
        </ul>
      )}
      {!showAll && items.length > FIRST && (
        <Link href={href(filter, true)} className="btn-secondary self-start">
          {fill(t.explore.showMore, { n: String(items.length - FIRST) })}
        </Link>
      )}
    </div>
  );
}
