"use client";

import Link from "next/link";
import en from "@/i18n/messages/en.json";

// Error boundaries are Client Components and can't read the route's dictionary;
// English is the only locale today. When more arrive, pass the locale's copy here.
const copy = en.errorPage;

/** Shown instead of a blank error when part of a page fails to load. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-4 py-20 sm:px-6">
      <h1 className="type-display text-5xl">{copy.title}</h1>
      <p className="text-lg text-text-muted">{copy.body}</p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          {copy.retry}
        </button>
        <Link href="/" className="font-medium underline underline-offset-4">
          {copy.home}
        </Link>
      </div>
    </section>
  );
}
