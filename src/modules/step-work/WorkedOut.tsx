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
                        <dd className="mt-1">
                          <Words own={a.answer} tidied={a.tidied} copy={copy} />
                          {a.assisted && <p className="mt-1 text-sm text-text-muted">{copy.assisted}</p>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {s.notes && (
                  <div>
                    <h3 className="text-sm font-semibold">{copy.notesLabel}</h3>
                    <div className="mt-1">
                      <Words own={s.notes} tidied={s.notesTidied} copy={copy} />
                    </div>
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

/**
 * The person's words, or Gusty's tidied copy with the original one tap away. Both stay clearly labelled:
 * the original is never replaced.
 */
function Words({ own, tidied, copy }: { own: string; tidied: string; copy: Messages["workedOut"] }) {
  if (!tidied || tidied === own) return <p className="whitespace-pre-line">{own}</p>;
  return (
    <>
      <p className="whitespace-pre-line">{tidied}</p>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-text-muted">
          {copy.tidied} · <span className="underline underline-offset-4">{copy.showOriginal}</span>
        </summary>
        <p className="mt-1 whitespace-pre-line border-l-2 border-border pl-3">{own}</p>
      </details>
    </>
  );
}
