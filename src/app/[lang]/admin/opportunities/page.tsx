import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { isAdmin } from "@/modules/admin/data";
import { getAllOpportunities } from "@/modules/opportunities/data";
import { OpportunityAdmin } from "@/modules/opportunities/OpportunityAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.notFound.title, robots: { index: false, follow: false } };
}

export default async function OpportunitiesAdminPage({ params }: PageProps<"/[lang]/admin/opportunities">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.admin.loading}</p>}>
        <Content params={params} t={t} />
      </Suspense>
    </section>
  );
}

async function Content({ params, t }: { params: PageProps<"/[lang]/admin/opportunities">["params"]; t: Messages }) {
  const { lang } = await params;
  // Everyone who isn't an admin sees the ordinary "not found" page.
  if (!(await isAdmin())) {
    return (
      <div className="flex flex-col items-start gap-6">
        <BrandSymbol name="two-waves" size={64} />
        <h1 className="type-display text-5xl">{t.notFound.title}</h1>
        <p className="text-lg text-text-muted">{t.notFound.body}</p>
      </div>
    );
  }
  const a = t.admin.opportunities;
  return (
    <div className="flex flex-col gap-8">
      <Link href={`/${lang}/admin`} className="text-sm font-medium underline underline-offset-4">← {a.back}</Link>
      <header>
        <h1 className="type-display text-5xl">{a.title}</h1>
        <p className="mt-3 text-lg text-text-muted">{a.intro}</p>
      </header>
      <OpportunityAdmin items={await getAllOpportunities()} copy={a} regions={t.explore.regions} />
    </div>
  );
}
