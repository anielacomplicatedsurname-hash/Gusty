import type { Metadata } from "next";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.offline.title, robots: { index: false, follow: false } };
}

/** Shown by the service worker when a page can't load because the device is offline. */
export default async function OfflinePage() {
  const t = await getMessages();
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-4 py-20 sm:px-6">
      <BrandSymbol name="two-waves" size={64} />
      <h1 className="type-display text-5xl">{t.offline.title}</h1>
      <p className="text-lg text-text-muted">{t.offline.body}</p>
      <p className="text-lg text-text-muted">{t.offline.saved}</p>
    </section>
  );
}
