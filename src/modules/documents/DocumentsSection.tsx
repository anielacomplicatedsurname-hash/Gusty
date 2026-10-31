import { BrandSymbol } from "@/components/BrandSymbol";
import type { Messages } from "@/i18n/dictionaries";
import { fill, formatDate } from "@/i18n/format";
import type { ProjectDocument } from "./data";
import { DocumentUpload } from "./DocumentUpload";
import { ForgetButton } from "./ForgetButton";

/** What Gusty learned from the project's documents (folded up), and a way to add another. */
export function DocumentsSection({ docs, projectId, lang, copy }: {
  docs: ProjectDocument[]; projectId: string; lang: string; copy: Messages["documents"];
}) {
  return (
    <section aria-labelledby="documents-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          <BrandSymbol name="leaf-cluster" size={28} />
          <h2 id="documents-title" className="text-xl font-semibold">{copy.addTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">{copy.addBody}</p>
      </div>
      {docs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {docs.map((d) => (
            <li key={d.id}>
              <details className="rounded-xl border border-border">
                <summary className="flex min-h-11 cursor-pointer flex-col justify-center p-4">
                  <span className="font-semibold">{d.filename}</span>
                  <span className="text-sm text-text-muted">
                    {formatDate(d.createdAt, lang)}{d.pages ? ` · ${fill(copy.pages, { n: String(d.pages) })}` : ""}
                  </span>
                </summary>
                <div className="flex flex-col gap-3 border-t border-border p-4">
                  <p className="text-sm text-text-muted">{copy.fromDocument}</p>
                  {d.summary && (
                    <div>
                      <h3 className="text-sm font-semibold">{copy.summaryLabel}</h3>
                      <p className="mt-1">{d.summary}</p>
                    </div>
                  )}
                  {d.done.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold">{copy.doneLabel}</h3>
                      <ul className="mt-1 list-disc pl-5">{d.done.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  )}
                  <ForgetButton id={d.id} filename={d.filename} label={copy.delete} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <DocumentUpload projectId={projectId} lang={lang} copy={copy} />
    </section>
  );
}
