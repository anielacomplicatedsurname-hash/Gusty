import type { ReactNode } from "react";

type Section = { heading: string; paragraphs?: string[]; items?: string[]; after?: string[] };
export type LegalCopy = { title: string; updated: string; intro: string; sections: Section[] };

/** Turns email addresses and bare domains like ico.org.uk into links. */
function linkify(text: string): ReactNode[] {
  return text.split(/(\b[\w.+-]+@[\w-]+\.[\w.]+\b|\bico\.org\.uk\b)/g).map((part, i) => {
    if (i % 2 === 0) return part;
    const href = part.includes("@") ? `mailto:${part}` : `https://${part}`;
    return (
      <a key={i} href={href} className="font-medium text-ink underline underline-offset-4">
        {part}
      </a>
    );
  });
}

/** A plain, readable legal page: privacy notice and terms. */
export function LegalPage({ copy }: { copy: LegalCopy }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="type-display text-5xl">{copy.title}</h1>
      <p className="mt-3 text-sm text-text-muted">{copy.updated}</p>
      <p className="mt-6 text-lg">{copy.intro}</p>
      {copy.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="type-heading">{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="mt-3 leading-relaxed">
              {linkify(p)}
            </p>
          ))}
          {section.items && (
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{linkify(item)}</li>
              ))}
            </ul>
          )}
          {section.after?.map((p) => (
            <p key={p} className="mt-3 leading-relaxed">
              {linkify(p)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
