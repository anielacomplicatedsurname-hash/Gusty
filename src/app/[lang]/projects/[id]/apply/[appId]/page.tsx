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
import { ConfirmButton } from "@/modules/projects/ConfirmButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.applications.listTitle, robots: { index: false, follow: false } };
}

export default async function ApplicationPage({ params }: PageProps<"/[lang]/projects/[id]/apply/[appId]">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.projects.loading}</p>}>
        <ApplicationContent params={params} t={t} />
      </Suspense>
    </section>
  );
}

async function ApplicationContent({ params, t }: { params: PageProps<"/[lang]/projects/[id]/apply/[appId]">["params"]; t: Messages }) {
  const { lang, id, appId } = await params;
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
        <p className="mt-3">{copy.pageIntro}</p>
      </header>

      <AddMaterial appId={app.id} lang={lang} copy={copy} />

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

      <Brief materials={app.materials} copy={copy} />
      <FitSection app={app} lang={lang} copy={copy} />

      <form action={deleteApplication} className="self-start">
        <input type="hidden" name="applicationId" value={app.id} />
        <input type="hidden" name="projectId" value={id} />
        <input type="hidden" name="lang" value={lang} />
        <ConfirmButton label={copy.deleteApplication} confirmText={copy.deleteConfirm} confirmLabel={copy.deleteYes} cancelLabel={copy.cancel} />
      </form>
    </div>
  );
}
