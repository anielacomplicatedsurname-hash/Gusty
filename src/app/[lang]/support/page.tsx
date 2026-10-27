import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supportChoices } from "@/config/support";
import { getMessages } from "@/i18n/dictionaries";
import { SupportCard } from "@/modules/support/SupportCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.support.pageTitle, description: t.support.pageDescription };
}

export default async function SupportPage({ params }: PageProps<"/[lang]/support">) {
  const { lang } = await params;
  const choices = supportChoices();
  if (!choices) notFound();
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <SupportCard choices={choices} copy={t.support} lang={lang} />
    </section>
  );
}
