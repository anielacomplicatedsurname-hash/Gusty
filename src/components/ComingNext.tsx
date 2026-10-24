import Link from "next/link";
import type { Metadata } from "next";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { BrandSymbol, type SymbolName } from "./BrandSymbol";

type Section = keyof Omit<Messages["comingNext"], "label" | "back">;

/** Placeholder pages are thin content: keep them out of search results until they're real. */
export async function comingNextMetadata(section: Section): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.comingNext[section].title, robots: { index: false, follow: true } };
}

/** An honest placeholder for a destination that isn't built yet. No fake content. */
export async function ComingNext({
  section,
  symbol,
  locale,
}: {
  section: Section;
  symbol: SymbolName;
  locale: string;
}) {
  const t = await getMessages();
  const copy = t.comingNext[section];
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:py-24">
      <BrandSymbol name={symbol} size={72} />
      <p className="type-label rounded-full bg-sky px-3 py-1 text-ink">{t.comingNext.label}</p>
      <h1 className="type-display text-5xl sm:text-6xl">{copy.title}</h1>
      <p className="text-lg text-text-muted">{copy.body}</p>
      <Link href={`/${locale}`} className="btn-secondary">
        {t.comingNext.back}
      </Link>
    </section>
  );
}
