import Link from "next/link";
import { BrandSymbol } from "@/components/BrandSymbol";
import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import type { WorkedStep } from "./data";

/** The steps someone has worked on, folded up by default so the page stays calm. */
export function WorkedOut({ steps, projectId, lang, copy }: { steps: WorkedStep[]; projectId: string; lang: string; copy: Messages["workedOut"] }) {
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="worked-title" className="rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <BrandSymbol name="sprout" size={28} />
        <h2 id="worked-title" className="text-xl font-semibold">
          {copy.title}
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">{copy.intro}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.id}>
            <details className="group rounded-xl border border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="mt-0.5 transition-transform group-open:rotate-90 motion-reduce:transition-none">
                  ›
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-sm text-text-muted">
                    {[
                      s.done ? copy.done : s.setAside ? copy.setAside : null,
                      s.answers.length === 1 ? copy.oneAnswer : s.answers.length > 1 ? fill(copy.answers, { n: String(s.answers.length) }) : null,
                      s.notes ? copy.notes : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-border p-4">
                {s.answers.length > 0 && (
                  <dl className="flex flex-col gap-3">
                    {s.answers.map((a) => (
                      <div key={a.question}>
                        <dt className="text-sm font-semibold">{a.question}</dt>
                        <dd className="mt-1 whitespace-pre-line">{a.answer}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {s.notes && (
                  <div>
                    <h3 className="text-sm font-semibold">{copy.notesLabel}</h3>
                    <p className="mt-1 whitespace-pre-line">{s.notes}</p>
                  </div>
                )}
                {s.setAside ? (
                  <p className="text-sm text-text-muted">{copy.setAsideHint}</p>
                ) : (
                  <Link
                    href={`/${lang}/projects/${projectId}/steps/${s.id}`}
                    aria-label={`${copy.edit}: ${s.title}`}
                    className="self-start text-sm font-medium underline underline-offset-4"
                  >
                    {copy.edit}
                  </Link>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
