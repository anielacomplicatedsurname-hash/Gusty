import { GuestCaptcha } from "@/components/GuestCaptcha";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { FeedbackForm } from "@/modules/feedback/FeedbackForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.feedback.title, robots: { index: false, follow: false } };
}

export default async function FeedbackPage({ params, searchParams }: PageProps<"/[lang]/feedback">) {
  const { lang } = await params;
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-24">
      <h1 className="type-display text-5xl">{t.feedback.title}</h1>
      <p className="mt-4 text-lg">{t.feedback.intro}</p>
      <div className="mt-8 rounded-(--radius-card) bg-surface-raised p-6 sm:p-8">
        <Suspense fallback={null}>
          <Form t={t} lang={lang} searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-text-muted">
        {t.feedback.privacy}{" "}
        <Link href={`/${lang}/privacy`} className="font-medium text-ink underline underline-offset-4">
          {t.feedback.privacyLink}
        </Link>
      </p>
    </section>
  );
}

async function Form({ t, lang, searchParams }: { t: Messages; lang: string; searchParams: PageProps<"/[lang]/feedback">["searchParams"] }) {
  const { from } = await searchParams;
  return <FeedbackForm page={typeof from === "string" ? from : ""} copy={t.feedback} captcha={<GuestCaptcha lang={lang} />} />;
}
