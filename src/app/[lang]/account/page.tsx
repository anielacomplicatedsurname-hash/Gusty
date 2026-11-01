import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { deleteAccount, signOut } from "@/modules/projects/actions";
import { ConfirmButton } from "@/modules/projects/ConfirmButton";
import { getCurrentUser } from "@/modules/projects/data";
import { EmailLinkForm } from "@/modules/projects/EmailLinkForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-24">
      <h1 className="type-display text-5xl sm:text-6xl">{t.account.title}</h1>
      <Suspense fallback={<p className="mt-10 text-text-muted">{t.projects.loading}</p>}>
        <AccountContent lang={lang} t={t} />
      </Suspense>
    </section>
  );
}

/** One place for the person's account: who they're signed in as, their data, and leaving. */
async function AccountContent({ lang, t }: { lang: string; t: Messages }) {
  const user = await getCurrentUser();
  const a = t.account;
  if (!user) {
    return (
      <div className="mt-10 flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-6">
        <p>{a.signedOut}</p>
        <EmailLinkForm lang={lang} copy={{ ...t.emailLink }} />
      </div>
    );
  }
  return (
    <div className="mt-10 flex flex-col gap-6">
      <section aria-labelledby="you-title" className="flex flex-col gap-3 rounded-(--radius-card) bg-surface-raised p-6">
        <h2 id="you-title" className="type-heading">{a.youTitle}</h2>
        {user.isAnonymous ? (
          <>
            <p className="text-text-muted">{a.guest}</p>
            <EmailLinkForm lang={lang} copy={{ ...t.emailLink }} />
          </>
        ) : (
          <form action={signOut} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="lang" value={lang} />
            <span>{fill(t.projects.signedInAs, { email: user.email ?? "" })}</span>
            <button type="submit" className="font-medium underline underline-offset-4">{t.projects.signOut}</button>
          </form>
        )}
      </section>

      <section aria-labelledby="data-title" className="flex flex-col items-start gap-3 rounded-(--radius-card) bg-surface-raised p-6">
        <h2 id="data-title" className="type-heading">{t.projects.yourData}</h2>
        <p className="text-text-muted">{t.projects.yourDataBody}</p>
        <a href={`/api/export?lang=${lang}`} download className="btn-secondary">{a.download}</a>
        <p className="text-sm text-text-muted">{a.downloadHint}</p>
        <a href="/api/export?format=json" download className="text-sm font-medium underline underline-offset-4">{a.downloadData}</a>
      </section>

      <section aria-labelledby="leave-title" className="flex flex-col items-start gap-3 rounded-(--radius-card) border border-border p-6">
        <h2 id="leave-title" className="type-heading">{a.leaveTitle}</h2>
        <p className="text-text-muted">{a.leaveBody}</p>
        <form action={deleteAccount}>
          <input type="hidden" name="lang" value={lang} />
          <ConfirmButton label={t.projects.deleteAccount} confirmText={t.projects.deleteAccountConfirm}
            confirmLabel={t.projects.deleteAccountYes} cancelLabel={t.projects.cancel} />
        </form>
      </section>

      <Link href={`/${lang}/projects`} className="self-start text-sm font-medium underline underline-offset-4">← {a.backToProjects}</Link>
    </div>
  );
}
