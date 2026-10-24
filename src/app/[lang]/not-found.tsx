import Link from "next/link";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages } from "@/i18n/dictionaries";

export default async function NotFound() {
  const t = await getMessages();
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <BrandSymbol name="two-waves" size={64} />
      <h1 className="type-display text-5xl">{t.notFound.title}</h1>
      <p className="text-lg text-text-muted">{t.notFound.body}</p>
      <Link href="/" className="btn-primary">
        {t.comingNext.back}
      </Link>
    </section>
  );
}
