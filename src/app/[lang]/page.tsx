import { BrandSymbol, type SymbolName } from "@/components/BrandSymbol";
import { Logo } from "@/components/Logo";
import { getMessages } from "@/i18n/dictionaries";

const stepSymbols: SymbolName[] = ["sprout", "spark", "path"];

function HandUnderline({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[5px] w-16 -rotate-3 rounded-full bg-ink ${className}`}
    />
  );
}

export default async function HomePage() {
  const t = await getMessages();

  return (
    <>
      <section className="mx-auto grid max-w-(--content-max) gap-10 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-20">
        <div>
          <p className="type-accent-hand text-lg">{t.home.overline}</p>
          <HandUnderline className="mt-1" />
          <h1 className="type-display mt-6 text-[3.25rem] sm:text-7xl lg:text-[5.5rem]">
            {t.home.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-text-muted">{t.home.lead}</p>

          <form className="mt-8 max-w-xl rounded-(--radius-card) border border-border bg-surface-raised p-4 shadow-[0_1px_0_rgba(17,17,17,0.04)] sm:p-5">
            <label htmlFor="idea" className="block text-lg font-semibold">
              {t.home.ideaLabel}
            </label>
            <p id="idea-hint" className="mt-1 text-sm text-text-muted">
              {t.home.ideaHint}
            </p>
            <textarea
              id="idea"
              name="idea"
              rows={4}
              aria-describedby="idea-hint idea-not-yet"
              className="mt-3 w-full resize-y rounded-xl border border-stone bg-paper p-3 text-base leading-relaxed placeholder:text-stone"
            />
            <div className="mt-3 flex flex-col gap-3">
              <p id="idea-not-yet" className="flex items-start gap-2 text-sm text-text-muted">
                <span className="mt-0.5 whitespace-nowrap rounded-full bg-sky px-2 py-0.5 text-xs font-medium text-ink">
                  {t.common.previewBadge}
                </span>
                <span>{t.home.ideaNotYet}</span>
              </p>
              <button type="submit" className="btn-primary sm:self-end" disabled>
                {t.home.ideaSubmit}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </div>

        <div className="relative hidden lg:block" aria-hidden="true">
          <Logo variant="hey" height={300} alt="" priority />
          <span className="absolute -bottom-6 right-6 text-ink/90">
            <BrandSymbol name="leaf-cluster" size={64} />
          </span>
          <span className="absolute -top-6 left-4 text-ink/80">
            <BrandSymbol name="spark" size={40} />
          </span>
        </div>
      </section>

      <section aria-labelledby="how" className="bg-oat/60">
        <div className="mx-auto max-w-(--content-max) px-4 py-14 sm:px-6">
          <h2 id="how" className="type-label text-ink">
            {t.home.howTitle}
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {t.home.steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-(--radius-card) bg-surface-raised p-6"
              >
                <div className="flex items-center gap-3">
                  <BrandSymbol name={stepSymbols[i]} size={36} />
                  <span className="type-label text-text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-(--content-max) px-4 py-16 text-center sm:px-6">
        <p className="type-display text-5xl sm:text-6xl">{t.home.closing}</p>
        <HandUnderline className="mx-auto mt-4" />
      </section>
    </>
  );
}
