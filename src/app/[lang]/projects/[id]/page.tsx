import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill, formatDateTime } from "@/i18n/format";
import { getProject } from "@/modules/projects/data";
import { getReading } from "@/modules/interpretation/data";
import { AutoRead, ReadingView } from "@/modules/interpretation/Reading";
import { IdeaEditor } from "@/modules/projects/IdeaEditor";
import { TitleEditor } from "@/modules/projects/TitleEditor";
import { deleteProject } from "@/modules/projects/actions";
import { ConfirmButton } from "@/modules/projects/ConfirmButton";
import { getStepsState } from "@/modules/steps/data";
import { NextSteps, TopStep } from "@/modules/steps/NextSteps";
import { getProjectOverview, type ProjectOverview } from "@/modules/projects/overview";
import { aiProvider } from "@/ai";
import { getDocuments } from "@/modules/documents/data";
import { getIdeaSummary } from "@/modules/idea-summary/data";
import { IdeaSummarySection } from "@/modules/idea-summary/IdeaSummarySection";
import { DocumentsSection } from "@/modules/documents/DocumentsSection";
import { AddStepButton } from "@/modules/explore/AddStepButton";
import { getReadiness } from "@/modules/readiness/data";
import { ReadinessSection } from "@/modules/readiness/Readiness";
import { getSavedOpportunities } from "@/modules/explore/data";
import { ResultCard } from "@/modules/explore/Results";
import { getWorkedOut } from "@/modules/step-work/data";
import { WorkedOut } from "@/modules/step-work/WorkedOut";
import { getSuggestions } from "@/modules/idea-loop/data";
import { Suggestions } from "@/modules/idea-loop/Suggestions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.projects.title, robots: { index: false, follow: false } };
}

const TABS = ["plan", "idea", "funding", "notes"] as const;
type Tab = (typeof TABS)[number];

export default async function ProjectPage({ params, searchParams }: PageProps<"/[lang]/projects/[id]">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.projects.loading}</p>}>
        <ProjectContent params={params} searchParams={searchParams} t={t} />
      </Suspense>
    </section>
  );
}

async function ProjectContent({
  params,
  searchParams,
  t,
}: {
  params: PageProps<"/[lang]/projects/[id]">["params"];
  searchParams: PageProps<"/[lang]/projects/[id]">["searchParams"];
  t: Messages;
}) {
  const [{ lang, id }, query] = await Promise.all([params, searchParams]);
  const [project, overview] = await Promise.all([getProject(id), getProjectOverview(id)]);
  const back = (
    <Link href={`/${lang}/projects`} className="text-sm font-medium underline underline-offset-4">
      ← {t.projects.back}
    </Link>
  );

  if (!project) {
    return (
      <div className="flex flex-col items-start gap-6">
        {back}
        <BrandSymbol name="two-waves" size={56} />
        <p className="text-lg">{t.projects.notFound}</p>
      </div>
    );
  }

  const projectPath = `/${lang}/projects/${project.id}`;
  // Plan opens first once there's a plan. Before that, the Idea tab does: it's where Gusty reads the idea
  // and the person checks what Gusty understood.
  const asked = TABS.find((name) => name === query.tab);
  const tab: Tab = asked ?? (overview && !overview.hasDirection ? "idea" : "plan");

  return (
    <div className="flex flex-col gap-6">
      {back}
      <header>
        <TitleEditor
          projectId={project.id}
          title={project.title}
          suggested={project.titleSource === "ai"}
          copy={t.projects}
        />
        <p className="mt-2 text-sm text-text-muted">
          {fill(t.projects.created, { date: formatDateTime(project.createdAt, lang) })}
        </p>
      </header>

      {overview && <ProgressChips overview={overview} projectPath={projectPath} t={t} />}
      {overview && <NextCard overview={overview} projectId={project.id} projectPath={projectPath} lang={lang} t={t} />}

      <nav aria-label={t.projectHome.tabsLabel} className="flex gap-1 rounded-full bg-oat p-1">
        {TABS.map((name) => (
          <Link key={name} href={`${projectPath}?tab=${name}`} aria-current={name === tab ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold ${
              name === tab ? "bg-ink text-paper" : "text-ink hover:bg-paper/70"}`}>
            {t.projectHome.tabs[name]}
          </Link>
        ))}
      </nav>

      {tab === "plan" && (
        <NextStepsSection projectId={project.id} lang={lang} t={t} hideCurrent={overview?.next.kind === "step"} />
      )}

      {tab === "idea" && (
        <>
          <SummaryBlock projectId={project.id} lang={lang} t={t}
            reading={
              <section aria-labelledby="reading-title" className="flex flex-col gap-3 border-t border-border pt-4">
                <div>
                  <h3 id="reading-title" className="scroll-mt-6 text-lg font-semibold">{t.interpretation.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{t.interpretation.intro}</p>
                </div>
                <ReadingSection projectId={project.id} lang={lang} t={t} />
              </section>
            }
            original={
              <IdeaEditor
                projectId={project.id}
                initialIdea={project.idea}
                copy={{ label: t.projects.ideaLabel, hint: t.projects.ideaHint, status: t.projects.save }}
              />
            }
          />
        </>
      )}

      {tab === "funding" && (
        <>
          <ReadinessBlock projectId={project.id} lang={lang} t={t} />
          <ExploreSection projectId={project.id} lang={lang} t={t} />
        </>
      )}

      {tab === "notes" && (
        <>
          <p className="-mt-2 text-sm text-text-muted">{t.workedOut.explainer}</p>
          <WorkedOutSection projectId={project.id} lang={lang} t={t} />
          <DocumentsBlock projectId={project.id} lang={lang} t={t} />
        </>
      )}

      <section aria-labelledby="feedback-card-title" className="rounded-(--radius-card) bg-sky/60 p-6 text-ink">
        <h2 id="feedback-card-title" className="text-lg font-semibold">{t.feedback.cardTitle}</h2>
        <p className="mt-1">{t.feedback.cardBody}</p>
        <Link href={`/${lang}/feedback?from=${encodeURIComponent(`/${lang}/projects/${project.id}`)}`} className="btn-secondary mt-4">
          {t.feedback.link}
        </Link>
      </section>

      <form action={deleteProject} className="self-start">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="lang" value={lang} />
        <ConfirmButton
          label={t.projects.deleteProject}
          confirmText={t.projects.deleteProjectConfirm}
          confirmLabel={t.projects.deleteProjectYes}
          cancelLabel={t.projects.cancel}
        />
      </form>
    </div>
  );
}

async function ReadingSection({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  const { facts, lastRun, unavailable } = await getReading(projectId);
  if (unavailable) return <p role="status">{t.interpretation.errors.unavailable}</p>;
  if (facts.length === 0) return <AutoRead projectId={projectId} lang={lang} copy={t.interpretation} />;
  return (
    <ReadingView
      projectId={projectId}
      lang={lang}
      facts={facts}
      demo={lastRun === "demo"}
      aiReady={aiProvider() !== null}
      copy={t.interpretation}
    />
  );
}

/**
 * "Your idea, as it stands": one card holding the summary, Gusty's suggested updates from finished steps,
 * what Gusty understood, and the person's own words folded underneath.
 */
async function SummaryBlock({ projectId, lang, t, original, reading }: {
  projectId: string; lang: string; t: Messages; original: ReactNode; reading: ReactNode;
}) {
  const [summary, suggestions] = await Promise.all([getIdeaSummary(projectId), getSuggestions(projectId)]);
  if (!summary) return <div className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">{reading}{original}</div>;
  return (
    <IdeaSummarySection summary={summary} projectId={projectId} lang={lang} copy={t.ideaSummary} original={original} reading={reading}
      suggestions={<Suggestions items={suggestions} labels={t.interpretation.sections} copy={t.ideaLoop} />} />
  );
}

/** One line of where the project is: its stage, how ready it is for funding, and what's been saved. */
function ProgressChips({ overview, projectPath, t }: { overview: ProjectOverview; projectPath: string; t: Messages }) {
  const h = t.projectHome;
  const chip = "inline-flex min-h-9 items-center rounded-full bg-oat px-3 text-sm text-ink hover:bg-oat/70";
  return (
    <ul className="-mt-2 flex flex-wrap gap-2" aria-label={t.readiness.progressLabel}>
      {overview.stage && (
        <li><Link href={`${projectPath}?tab=plan`} className={chip}>{fill(h.stageChip, { n: String(overview.stage.number), title: overview.stage.title })}</Link></li>
      )}
      <li><Link href={`${projectPath}?tab=funding`} className={chip}>{fill(h.readyChip, { n: String(overview.ready.done), total: String(overview.ready.total) })}</Link></li>
      {overview.suggestions > 0 && (
        <li><Link href={`${projectPath}?tab=idea#suggestions-title`} className={chip}>
          {overview.suggestions === 1 ? t.ideaLoop.chip : fill(t.ideaLoop.chipMany, { n: String(overview.suggestions) })}
        </Link></li>
      )}
      {overview.saved > 0 && (
        <li><Link href={`${projectPath}?tab=funding`} className={chip}>{overview.saved === 1 ? h.oneSavedChip : fill(h.manySavedChip, { n: String(overview.saved) })}</Link></li>
      )}
    </ul>
  );
}

/** The single most useful thing to do now, always at the top. */
function NextCard({ overview, projectId, projectPath, lang, t }: {
  overview: ProjectOverview; projectId: string; projectPath: string; lang: string; t: Messages;
}) {
  const next = overview.next;
  const h = t.projectHome;
  return (
    <section aria-labelledby="next-title" className="flex flex-col gap-3">
      <h2 id="next-title" className="type-label text-text-muted">{h.nextLabel}</h2>
      {next.kind === "step" ? (
        <TopStep step={next.step} projectId={projectId} lang={lang} copy={t.steps} />
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-signal p-4 text-ink">
          <p className="text-lg font-semibold">{h.next[next.kind].title}</p>
          <p>{h.next[next.kind].body}</p>
          <Link className="btn-primary mt-2" href={
            next.kind === "explore" ? `/${lang}/explore?project=${projectId}`
              : next.kind === "reading" ? `${projectPath}?tab=idea`
              : `${projectPath}?tab=plan`}>
            {h.next[next.kind].action}
          </Link>
        </div>
      )}
    </section>
  );
}

/** What Gusty learned from the project's own documents, and a way to add one. */
async function DocumentsBlock({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  return <DocumentsSection docs={await getDocuments(projectId)} projectId={projectId} lang={lang} copy={t.documents} />;
}

/** Answers and notes from the steps, once there are any. */
async function WorkedOutSection({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  return <WorkedOut steps={await getWorkedOut(projectId)} projectId={projectId} lang={lang} copy={t.workedOut} />;
}

/** How ready the project is for funding, and Gusty's view of the routes that suit it. */
async function ReadinessBlock({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  const readiness = await getReadiness(projectId);
  if (!readiness) return null;
  return <ReadinessSection readiness={readiness} projectId={projectId} lang={lang} copy={t.readiness} />;
}

/** A way into Explore for this project, and the opportunities saved from it. */
async function ExploreSection({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  const saved = await getSavedOpportunities(projectId);
  return (
    <section aria-labelledby="explore-card-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          <BrandSymbol name="horizon-hill" size={28} />
          <h2 id="explore-card-title" className="text-xl font-semibold">{t.projects.exploreTitle}</h2>
        </div>
        <p className="mt-1 text-text-muted">{t.projects.exploreBody}</p>
        <Link href={`/${lang}/explore?project=${projectId}`} className="btn-secondary mt-4">{t.projects.exploreLink}</Link>
      </div>
      {saved.length > 0 && (
        <section aria-labelledby="saved-title" className="flex flex-col gap-3 border-t border-border pt-4">
          <div>
            <h3 id="saved-title" className="text-lg font-semibold">{t.projects.savedTitle}</h3>
            <p className="text-sm text-text-muted">{t.projects.savedIntro}</p>
          </div>
          <ul className="flex flex-col gap-4">
            {saved.map((o) => (
              <li key={o.id}>
                <ResultCard item={o} lang={lang} copy={t.explore}>
                  <AddStepButton id={o.id} title={o.title} lang={lang} copy={t.projects} />
                </ResultCard>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/** Next steps appear once Gusty has read the idea. */
async function NextStepsSection({ projectId, lang, t, hideCurrent = false }: {
  projectId: string; lang: string; t: Messages; hideCurrent?: boolean;
}) {
  const [{ facts }, state] = await Promise.all([getReading(projectId), getStepsState(projectId)]);
  if (facts.length === 0 || state.unavailable) return null;
  return (
    <section aria-labelledby="steps-title" className="rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <BrandSymbol name="path" size={28} />
        <h2 id="steps-title" className="text-xl font-semibold">
          {t.steps.title}
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">{t.steps.intro}</p>
      <div className="mt-5">
        <NextSteps
          projectId={projectId}
          lang={lang}
          directions={state.directions}
          stages={state.stages}
          steps={state.steps}
          initialMode={state.mode}
          demo={state.demo}
          hideCurrent={hideCurrent}
          copy={t.steps}
        />
      </div>
    </section>
  );
}
