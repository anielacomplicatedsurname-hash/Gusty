import { BrandSymbol, type SymbolName } from "@/components/BrandSymbol";
import { Logo } from "@/components/Logo";
import { getMessages } from "@/i18n/dictionaries";
import { supabaseConfig } from "@/lib/supabase/config";
import { IdeaForm } from "@/modules/projects/IdeaForm";

const stepSymbols: SymbolName[] = ["sprout", "spark", "path"];

function HandUnderline({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[5px] w-16 -rotate-3 rounded-full bg-ink ${className}`}
    />
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
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

          <IdeaForm
            lang={lang}
            enabled={supabaseConfig() !== null}
            copy={{
              label: t.home.ideaLabel,
              hint: t.home.ideaHint,
              submit: t.home.ideaSubmit,
              saving: t.home.ideaSaving,
              privacy: t.home.ideaPrivacy,
              unavailable: t.home.ideaUnavailable,
              previewBadge: t.common.previewBadge,
              errors: t.home.ideaErrors,
            }}
          />
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
