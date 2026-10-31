import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { deleteApplication } from "@/modules/applications/actions";
import { AddMaterial, RemoveMaterial } from "@/modules/applications/AddMaterial";
import { Brief } from "@/modules/applications/Brief";
import { getApplication } from "@/modules/applications/data";
import { FitSection } from "@/modules/applications/FitSection";
import { AnswersSection } from "@/modules/applications/AnswersSection";
import { questionsOf } from "@/modules/applications/questions";
import { aiProvider } from "@/ai";
import { ConfirmButton } from "@/modules/projects/ConfirmButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.applications.listTitle, robots: { index: false, follow: false } };
}

export default async function ApplicationPage({ params, searchParams }: PageProps<"/[lang]/projects/[id]/apply/[appId]">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.projects.loading}</p>}>
        <ApplicationContent params={params} searchParams={searchParams} t={t} />
      </Suspense>
    </section>
  );
}

const VIEWS = ["papers", "brief", "fit", "answers"] as const;
type View = (typeof VIEWS)[number];

async function ApplicationContent({ params, searchParams, t }: {
  params: PageProps<"/[lang]/projects/[id]/apply/[appId]">["params"];
  searchParams: PageProps<"/[lang]/projects/[id]/apply/[appId]">["searchParams"];
  t: Messages;
}) {
  const [{ lang, id, appId }, query] = await Promise.all([params, searchParams]);
  const app = await getApplication(id, appId);
  const copy = t.applications;
  const back = (
    <Link href={`/${lang}/projects/${id}?tab=funding`} className="text-sm font-medium underline underline-offset-4">← {copy.back}</Link>
  );
  if (!app) {
    return (
      <div className="flex flex-col items-start gap-6">
        {back}
        <BrandSymbol name="two-waves" size={56} />
        <p className="text-lg">{copy.notFound}</p>
      </div>
    );
  }
  const path = `/${lang}/projects/${id}/apply/${app.id}`;
  const questions = questionsOf(app.materials);
  // Papers first until there are some; then straight to the answers, the main work.
  const asked = VIEWS.find((name) => name === query.view);
  const view: View = asked ?? (app.materials.length === 0 ? "papers" : "answers");

  return (
    <div className="flex flex-col gap-6">
      {back}
      <header>
        <p className="type-label text-text-muted">{app.projectTitle}</p>
        <h1 className="type-display mt-1 text-3xl sm:text-4xl">{app.title}</h1>
        {(app.funder || app.url) && (
          <p className="mt-2 text-text-muted">
            {app.funder}
            {app.funder && app.url && " · "}
            {app.url && <a href={app.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{app.url.replace(/^https:\/\//, "").slice(0, 60)}</a>}
          </p>
        )}
      </header>

      <nav aria-label={copy.viewsLabel} className="flex gap-1 rounded-full bg-oat p-1">
        {VIEWS.map((name) => (
          <Link key={name} href={`${path}?view=${name}`} aria-current={name === view ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-1 text-center text-sm font-semibold leading-tight ${
              name === view ? "bg-ink text-paper" : "text-ink hover:bg-paper/70"}`}>
            {copy.views[name]}
          </Link>
        ))}
      </nav>

      {view === "papers" && (
        <>
          <p className="-mt-2 text-sm text-text-muted">{copy.pageIntro}</p>
          {app.materials.length > 0 && (
            <section aria-labelledby="papers-title" className="flex flex-col gap-3">
              <h2 id="papers-title" className="text-lg font-semibold">{copy.papersTitle}</h2>
              <ul className="flex flex-col gap-2">
                {app.materials.map((m) => {
                  const label = m.origin === "paste" ? `${copy.pasted}: ${m.label}` : m.label;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                      <span className="flex flex-col">
                        <span className="font-medium">{copy.kinds[m.kind]}</span>
                        <span className="break-all text-sm text-text-muted">{label}{m.pages ? ` · ${fill(copy.pages, { n: String(m.pages) })}` : ""}</span>
                      </span>
                      <RemoveMaterial id={m.id} label={label} lang={lang} copy={copy} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <AddMaterial appId={app.id} lang={lang} copy={copy} startOpen={app.materials.length === 0} nextHref={`${path}?view=brief`} papersHref={`${path}?view=papers`} />
        </>
      )}
      {view === "brief" && <Brief materials={app.materials} copy={copy} />}
      {view === "fit" && (app.materials.length > 0
        ? <FitSection app={app} lang={lang} copy={copy} />
        : <p className="text-text-muted">{copy.nothingYet}</p>)}
      {view === "answers" && (
        <AnswersSection appId={app.id} title={app.title} questions={questions} answers={app.answers}
          demo={aiProvider() === null} lang={lang} copy={copy} />
      )}

      <form action={deleteApplication} className="self-start">
        <input type="hidden" name="applicationId" value={app.id} />
        <input type="hidden" name="projectId" value={id} />
        <input type="hidden" name="lang" value={lang} />
        <ConfirmButton label={copy.deleteApplication} confirmText={copy.deleteConfirm} confirmLabel={copy.deleteYes} cancelLabel={copy.cancel} />
      </form>
    </div>
  );
}

