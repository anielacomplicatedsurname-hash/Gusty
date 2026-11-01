import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supportChoices } from "@/config/support";
import { getMessages } from "@/i18n/dictionaries";
import { SupportCard } from "@/modules/support/SupportCard";
import { SupportHelp } from "@/modules/support/SupportHelp";

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
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-14 sm:px-6 md:py-24">
      <SupportCard choices={choices} copy={t.support} lang={lang} />
      <SupportHelp copy={t.support} manageHref={choices.manage} stacked />
    </div>
  );
}
