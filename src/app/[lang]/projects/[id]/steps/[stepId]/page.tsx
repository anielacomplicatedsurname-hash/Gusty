import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { getStepWork } from "@/modules/step-work/data";
import { StepWorkspace } from "@/modules/step-work/StepWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stepWork.eyebrow, robots: { index: false, follow: false } };
}

export default async function StepPage({ params }: PageProps<"/[lang]/projects/[id]/steps/[stepId]">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.projects.loading}</p>}>
        <StepContent params={params} t={t} />
      </Suspense>
    </section>
  );
}

async function StepContent({ params, t }: { params: PageProps<"/[lang]/projects/[id]/steps/[stepId]">["params"]; t: Messages }) {
  const { lang, id, stepId } = await params;
  const work = await getStepWork(id, stepId);
  const back = (
    <Link href={`/${lang}/projects/${id}`} className="text-sm font-medium underline underline-offset-4">
      ← {t.stepWork.back}
    </Link>
  );
  if (!work) {
    return (
      <div className="flex flex-col items-start gap-6">
        {back}
        <BrandSymbol name="two-waves" size={56} />
        <p className="text-lg">{t.stepWork.notFound}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-3">
        {back}
        <p className="type-label text-text-muted">{t.stepWork.eyebrow} · {work.projectTitle}</p>
        <h1 className="type-display text-4xl sm:text-5xl">{work.step.title}</h1>
        {work.step.detail && <p className="text-lg">{work.step.detail}</p>}
        <p className="text-text-muted">{t.stepWork.intro}</p>
      </div>
      <StepWorkspace work={work} lang={lang} copy={t.stepWork} />
    </div>
  );
}
