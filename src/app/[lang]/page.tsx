import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol, type SymbolName } from "@/components/BrandSymbol";
import { Logo } from "@/components/Logo";
import { getMessages } from "@/i18n/dictionaries";
import { WelcomeBack } from "@/modules/projects/WelcomeBack";
import { supportChoices } from "@/config/support";
import { supabaseConfig } from "@/lib/supabase/config";
import { IdeaForm } from "@/modules/projects/IdeaForm";
import { SupportCard } from "@/modules/support/SupportCard";

const featureSymbols: SymbolName[] = ["sprout", "horizon-hill", "bridge"];

/** A hand-drawn marker swipe behind a few words, in Signal. Decorative: hidden from screen readers. */
function MarkerSwipe() {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 40" preserveAspectRatio="none"
      className="absolute -inset-x-3 -bottom-[0.08em] h-[72%] w-[calc(100%+1.5rem)] -rotate-1 fill-signal">
      <path d="M6 10 C 50 4, 110 12, 160 6 S 196 8, 198 12 L 194 36 C 140 32, 90 40, 40 34 S 8 38, 3 34 Z" />
    </svg>
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const t = await getMessages();
  const support = supportChoices();

  return (
    <>
      <section className="bg-linear-to-b from-surface-raised/60 to-surface">
        <div className="mx-auto grid max-w-(--content-max) gap-10 px-4 pb-24 pt-12 sm:px-6 md:pb-32 md:pt-20 lg:grid-cols-[1.35fr_0.65fr] lg:items-center lg:pt-28">
          <div>
            {/* For people coming back: "Pick up where you left off" comes first. */}
            <Suspense fallback={null}>
              <WelcomeBack lang={lang} t={t} />
            </Suspense>
            {/* Two balanced lines of thought, so no word is left alone on a line. */}
            <h1 className="type-display text-[3.25rem] sm:text-7xl lg:text-[5.5rem]">
              <span className="block text-balance">{t.home.headline}</span>{" "}
              <em className="block text-balance italic">{t.home.headlineItalic}</em>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">{t.home.lead}</p>

            <IdeaForm
              lang={lang}
              enabled={supabaseConfig() !== null}
              copy={{
                label: t.home.ideaLabel,
                hint: t.home.ideaHint,
                submit: t.home.ideaSubmit,
                pdf: t.home.ideaPdf,
                saving: t.home.ideaSaving,
                privacy: t.home.ideaPrivacy,
                unavailable: t.home.ideaUnavailable,
                previewBadge: t.common.previewBadge,
                errors: t.home.ideaErrors,
              }}
            />
          </div>

          <div className="hidden lg:flex lg:justify-end" aria-hidden="true">
            <Logo variant="hey" height={380} alt="" priority />
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-(--content-max) px-4 py-24 sm:px-6 md:py-36">
        <p className="type-label text-text-muted">{t.home.howTitle}</p>
        {/* The brand line, where it means most: right above the three small steps. */}
        <h2 id="how" className="type-display mt-3 text-5xl sm:text-6xl lg:text-7xl">
          {t.home.sloganBig}{" "}
          <span className="relative inline-block whitespace-nowrap">
            <MarkerSwipe />
            <em className="relative italic">{t.home.sloganSmall}</em>
          </span>
        </h2>
        <div className="mt-14 grid items-center gap-10 md:mt-24 md:grid-cols-2 md:gap-16">
          <div className="hidden justify-center md:flex">
            <BrandSymbol name="path" size={260} />
          </div>
          <div>
            <p className="type-label mb-4 text-text-muted">{t.home.stepsLabel}</p>
            {/* What happens, in order: numbered, not arrows, so nothing here looks clickable. */}
            <ol className="border-b border-border">
              {t.home.steps.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[2.5rem_1fr] border-t border-border py-6">
                  <span className="type-display text-2xl text-text-muted" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="mt-1 text-text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-text-muted">
              {t.home.howMore}{" "}
              <Link href={`/${lang}/projects`} className="font-medium text-ink underline underline-offset-4">
                {t.home.howLink}
              </Link>
              <span aria-hidden="true"> →</span>
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="features"
        className="bg-[radial-gradient(120%_90%_at_50%_120%,var(--signal)_0%,#f0f1d2_45%,var(--surface)_80%)]"
      >
        <div className="mx-auto max-w-(--content-max) px-4 py-24 sm:px-6 md:py-36">
          <p className="type-label text-text-muted">{t.home.featuresLabel}</p>
          <h2 id="features" className="type-display mt-3 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
            {t.home.featuresTitle}
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-text-muted sm:text-xl">{t.home.featuresBody}</p>
          <ul className="mt-12 grid gap-5 md:mt-20 md:grid-cols-3 md:gap-7">
            {t.home.features.map((f, i) => (
              <li key={f.title} className="flex flex-col rounded-(--radius-card) border border-border bg-surface-raised/85 p-7 md:min-h-72 md:p-9">
                <BrandSymbol name={featureSymbols[i]} size={44} />
                <h3 className="type-display mt-7 text-3xl">{f.title}</h3>
                <p className="mt-3 text-text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {support && (
        <div className="mx-auto max-w-3xl px-4 pt-24 sm:px-6">
          <SupportCard choices={support} copy={t.support} lang={lang} />
        </div>
      )}

      <section className="mx-auto max-w-(--content-max) px-4 py-24 sm:px-6 md:py-36">
        <p className="type-display text-5xl sm:text-6xl lg:text-7xl">
          {t.home.closingStart}{" "}
          <span className="relative inline-block whitespace-nowrap">
            <MarkerSwipe />
            <em className="relative italic">{t.home.closingEnd}</em>
          </span>
        </p>
      </section>
    </>
  );
}
