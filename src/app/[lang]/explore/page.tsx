import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { getExploreState } from "@/modules/explore/data";
import { Results } from "@/modules/explore/Results";
import { SearchPanel } from "@/modules/explore/SearchPanel";
import { listProjects } from "@/modules/projects/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  // Explore is personal: it works from the visitor's own projects.
  return { title: t.explore.title, description: t.explore.metaDescription, robots: { index: false, follow: true } };
}

export default async function ExplorePage({ params, searchParams }: PageProps<"/[lang]/explore">) {
  const t = await getMessages();
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
      <header className="flex flex-col items-start gap-4">
        <BrandSymbol name="horizon-hill" size={56} />
        <h1 className="type-display text-5xl sm:text-6xl">{t.explore.title}</h1>
        <p className="text-lg">{t.explore.intro}</p>
      </header>
      <Suspense fallback={<p className="text-text-muted">…</p>}>
        <ExploreContent params={params} searchParams={searchParams} t={t} />
      </Suspense>
    </section>
  );
}

async function ExploreContent({ params, searchParams, t }: {
  params: PageProps<"/[lang]/explore">["params"]; searchParams: PageProps<"/[lang]/explore">["searchParams"]; t: Messages;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const projects = await listProjects();
  const e = t.explore;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>{e.noProjects}</p>
        <Link href={`/${lang}`} className="btn-primary">{e.startIdea}</Link>
      </div>
    );
  }

  const chosen = projects.find((p) => p.id === query.project) ?? (projects.length === 1 ? projects[0] : null);
  if (!chosen) {
    return (
      <nav aria-labelledby="choose-title" className="flex flex-col gap-3">
        <h2 id="choose-title" className="text-xl font-semibold">{e.chooseTitle}</h2>
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/${lang}/explore?project=${p.id}`} className="flex min-h-12 items-center rounded-xl border border-border px-4 font-medium hover:bg-oat/60">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const state = await getExploreState(chosen.id);
  if (!state) return <p role="status">{e.errors.unavailable}</p>;
  const latest = state.latest;
  const results = latest?.results ?? [];
  const hasDone = !!latest && (latest.status === "done" || results.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{fill(e.forProject, { title: chosen.title })}</h2>
        {projects.length > 1 && (
          <Link href={`/${lang}/explore`} className="self-start text-sm font-medium underline underline-offset-4">{e.chooseAnother}</Link>
        )}
      </div>
      <SearchPanel
        key={chosen.id}
        projectId={chosen.id}
        lang={lang}
        place={state.place}
        running={latest?.status === "running"}
        failed={latest?.status === "failed"}
        limit={state.limit}
        hasResults={hasDone}
        copy={e}
      />
      {hasDone && latest && (
        <Results results={results} foundOn={latest.createdAt} place={latest.place} lang={lang} demo={state.demo} copy={e} />
      )}
    </div>
  );
}
