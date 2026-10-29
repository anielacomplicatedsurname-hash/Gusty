import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
import { NextSteps } from "@/modules/steps/NextSteps";
import { aiProvider } from "@/ai";
import { getWorkedOut } from "@/modules/step-work/data";
import { WorkedOut } from "@/modules/step-work/WorkedOut";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.projects.title, robots: { index: false, follow: false } };
}

export default async function ProjectPage({ params }: PageProps<"/[lang]/projects/[id]">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.projects.loading}</p>}>
        <ProjectContent params={params} t={t} />
      </Suspense>
    </section>
  );
}

async function ProjectContent({
  params,
  t,
}: {
  params: PageProps<"/[lang]/projects/[id]">["params"];
  t: Messages;
}) {
  const { lang, id } = await params;
  const project = await getProject(id);
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

  return (
    <div className="flex flex-col gap-8">
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

      <div className="rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
        <IdeaEditor
          projectId={project.id}
          initialIdea={project.idea}
          copy={{ label: t.projects.ideaLabel, hint: t.projects.ideaHint, status: t.projects.save }}
        />
      </div>

      <section
        aria-labelledby="reading-title"
        className="rounded-(--radius-card) bg-surface-raised p-5 sm:p-6"
      >
        <div className="flex items-center gap-3">
          <BrandSymbol name="spark" size={28} />
          <h2 id="reading-title" className="text-xl font-semibold">
            {t.interpretation.title}
          </h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">{t.interpretation.intro}</p>
        <div className="mt-5">
          <ReadingSection projectId={project.id} lang={lang} t={t} />
        </div>
      </section>

      <WorkedOutSection projectId={project.id} lang={lang} t={t} />

      <NextStepsSection projectId={project.id} lang={lang} t={t} />

      <section aria-labelledby="explore-card-title" className="rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <BrandSymbol name="horizon-hill" size={28} />
          <h2 id="explore-card-title" className="text-xl font-semibold">{t.projects.exploreTitle}</h2>
        </div>
        <p className="mt-1 text-text-muted">{t.projects.exploreBody}</p>
        <Link href={`/${lang}/explore?project=${project.id}`} className="btn-secondary mt-4">{t.projects.exploreLink}</Link>
      </section>

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

/** Answers and notes from the steps, once there are any. */
async function WorkedOutSection({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
  return <WorkedOut steps={await getWorkedOut(projectId)} projectId={projectId} lang={lang} copy={t.workedOut} />;
}

/** Next steps appear once Gusty has read the idea. */
async function NextStepsSection({ projectId, lang, t }: { projectId: string; lang: string; t: Messages }) {
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
          copy={t.steps}
        />
      </div>
    </section>
  );
}
