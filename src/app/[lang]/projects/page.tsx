import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill, formatDateTime } from "@/i18n/format";
import { deleteAccount, signOut } from "@/modules/projects/actions";
import { ConfirmButton } from "@/modules/projects/ConfirmButton";
import { getCurrentUser, listProjects, type ProjectSummary } from "@/modules/projects/data";
import { DocumentUpload } from "@/modules/documents/DocumentUpload";
import { freshness } from "@/modules/explore/data";
import { getProjectOverview } from "@/modules/projects/overview";
import { nextText } from "@/modules/projects/WelcomeBack";
import { EmailLinkForm } from "@/modules/projects/EmailLinkForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.projects.title, robots: { index: false, follow: false } };
}

export default async function ProjectsPage({ params, searchParams }: PageProps<"/[lang]/projects">) {
  const { lang } = await params;
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="type-display text-5xl sm:text-6xl">{t.projects.title}</h1>
      <p className="mt-4 text-lg text-text-muted">{t.projects.intro}</p>
      <Suspense fallback={<p className="mt-10 text-text-muted">{t.projects.loading}</p>}>
        <ProjectsContent lang={lang} t={t} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ProjectsContent({
  lang,
  t,
  searchParams,
}: {
  lang: string;
  t: Messages;
  searchParams: PageProps<"/[lang]/projects">["searchParams"];
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const emailCopy = { ...t.emailLink };
  const signInFailed = query.signin === "failed" && (
    <p role="alert" className="mt-8 rounded-xl bg-sky p-3 text-sm font-medium text-ink">
      {t.projects.signInFailed}
    </p>
  );

  if (!user) {
    return (
      <>
        {signInFailed}
        <div className="mt-10 rounded-(--radius-card) bg-surface-raised p-6">
          <h2 className="text-xl font-semibold">{t.projects.signedOutTitle}</h2>
          <p className="mt-2 text-text-muted">{t.projects.signedOutBody}</p>
          <div className="mt-4">
            <EmailLinkForm lang={lang} copy={emailCopy} />
          </div>
        </div>
        <EmptyState lang={lang} t={t} />
      <section aria-labelledby="import-title" className="mt-10 flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-6">
        <h2 id="import-title" className="text-xl font-semibold">{t.documents.newTitle}</h2>
        <p className="text-text-muted">{t.documents.newBody}</p>
        <DocumentUpload lang={lang} copy={t.documents} />
      </section>
      </>
    );
  }

  const projects = await listProjects();
  return (
    <>
      {signInFailed}
      {projects.length === 0 ? (
        <EmptyState lang={lang} t={t} />
      ) : (
        <ul className="mt-10 flex flex-col gap-3" aria-label={t.projects.title}>
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      )}

      {/* Guests first: adding an email is what keeps their work safe. */}
      {user.isAnonymous && (
        <div className="mt-10 rounded-(--radius-card) bg-surface-raised p-6">
          <h2 className="text-xl font-semibold">{t.projects.keepTitle}</h2>
          <p className="mt-2 text-text-muted">{t.projects.keepBody}</p>
          <div className="mt-4">
            <EmailLinkForm lang={lang} copy={emailCopy} />
          </div>
        </div>
      )}
      <section aria-labelledby="import-title" className="mt-10 flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-6">
        <h2 id="import-title" className="text-xl font-semibold">{t.documents.newTitle}</h2>
        <p className="text-text-muted">{t.documents.newBody}</p>
        <DocumentUpload lang={lang} copy={t.documents} />
      </section>

      <section aria-labelledby="your-data" className="mt-10 flex flex-col items-start gap-3">
        <h2 id="your-data" className="type-label text-text-muted">{t.projects.yourData}</h2>
        <p className="text-sm text-text-muted">{t.projects.yourDataBody}</p>
        <a href="/api/export" download className="text-sm font-medium underline underline-offset-4">
          {t.projects.download}
        </a>
        <form action={deleteAccount}>
          <input type="hidden" name="lang" value={lang} />
          <ConfirmButton
            label={t.projects.deleteAccount}
            confirmText={t.projects.deleteAccountConfirm}
            confirmLabel={t.projects.deleteAccountYes}
            cancelLabel={t.projects.cancel}
          />
        </form>
      </section>

      {!user.isAnonymous && (
        <form action={signOut} className="mt-10 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <input type="hidden" name="lang" value={lang} />
          <span>{fill(t.projects.signedInAs, { email: user.email ?? "" })}</span>
          <button type="submit" className="font-medium text-ink underline underline-offset-4">
            {t.projects.signOut}
          </button>
        </form>
      )}
    </>
  );
}

function EmptyState({ lang, t }: { lang: string; t: Messages }) {
  return (
    <div className="mt-10 flex flex-col items-start gap-4">
      <BrandSymbol name="sprout" size={48} />
      <p className="text-text-muted">{t.projects.empty}</p>
      <Link href={`/${lang}`} className="btn-primary">
        {t.projects.startNew}
      </Link>
    </div>
  );
}

/** A project with where it's at: its stage and next step, how ready it is for funding, how fresh its deep search is. */
async function ProjectCard({ project, lang, t }: { project: ProjectSummary; lang: string; t: Messages }) {
  const overview = await getProjectOverview(project.id);
  const fresh = overview?.lastSearch ? freshness(overview.lastSearch) : null;
  return (
    <Link href={`/${lang}/projects/${project.id}`}
      className="flex items-center gap-4 rounded-(--radius-card) bg-surface-raised p-5 transition-colors hover:bg-oat">
      <BrandSymbol name="sprout" size={28} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-lg font-semibold">{project.title}</span>
        {overview && (
          <>
            <span className="text-sm">
              {overview.stage && `${fill(t.projectHome.stageChip, { n: String(overview.stage.number), title: overview.stage.title })} · `}
              {fill(t.projectHome.cardNext, { step: nextText(overview.next, t) })}
            </span>
            <span aria-hidden="true" className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-oat">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${(overview.ready.done / overview.ready.total) * 100}%` }} />
            </span>
            <span className="text-sm text-text-muted">
              {fill(t.projectHome.readyChip, { n: String(overview.ready.done), total: String(overview.ready.total) })}
              {fresh && fresh !== "never" && ` · ${t.projectHome.searched[fresh]}`}
            </span>
          </>
        )}
        <span className="text-sm text-text-muted">{fill(t.projects.lastSaved, { date: formatDateTime(project.updatedAt, lang) })}</span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
