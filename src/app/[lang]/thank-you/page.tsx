import type { Metadata } from "next";
import Link from "next/link";
import { BrandSymbol } from "@/components/BrandSymbol";
import { supportChoices } from "@/config/support";
import { getMessages } from "@/i18n/dictionaries";
import { SupportHelp } from "@/modules/support/SupportHelp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.support.thankYouTitle, robots: { index: false, follow: false } };
}

/** Where Stripe sends people after they support Gusty. */
export default async function ThankYouPage({ params }: PageProps<"/[lang]/thank-you">) {
  const { lang } = await params;
  const t = await getMessages();
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-4 py-20 sm:px-6">
      <BrandSymbol name="two-waves" size={64} />
      <h1 className="type-display text-5xl">{t.support.thankYouTitle}</h1>
      <p className="text-lg text-text-muted">{t.support.thankYouBody}</p>
      <Link href={`/${lang}`} className="btn-primary">
        {t.support.back}
      </Link>
      <div className="mt-6 w-full">
        <SupportHelp copy={t.support} manageHref={supportChoices()?.manage ?? null} />
      </div>
    </section>
  );
}
