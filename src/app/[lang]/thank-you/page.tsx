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
    <div className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-14 sm:px-6 md:py-20">
      <section className="flex flex-col items-start gap-5">
        <BrandSymbol name="two-waves" size={64} />
        <h1 className="type-display text-5xl sm:text-6xl">
          {t.support.thankYouTitle} <span aria-hidden="true">💨</span>
        </h1>
        <p className="max-w-xl text-xl">{t.support.thankYouBody}</p>
        <p className="flex items-center gap-2 rounded-full bg-oat px-4 py-2 text-sm font-medium">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          {t.support.thankYouReceipt}
        </p>
        <Link href={`/${lang}`} className="btn-primary mt-2">
          {t.support.back}
        </Link>
      </section>

      <SupportHelp copy={t.support} manageHref={supportChoices()?.manage ?? null} />
    </div>
  );
}
