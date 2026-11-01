import { GuestCaptcha } from "@/components/GuestCaptcha";
import Link from "next/link";
import { Suspense } from "react";
import { BrandSymbol, type SymbolName } from "@/components/BrandSymbol";
import { Logo } from "@/components/Logo";
import { getMessages } from "@/i18n/dictionaries";
import { StartArea } from "@/modules/projects/StartArea";
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
  const ideaForm = (
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
      captcha={<Suspense fallback={null}><GuestCaptcha lang={lang} /></Suspense>}
    />
  );

  return (
    <>
      <section className="bg-linear-to-b from-surface-raised/60 to-surface">
        <div className="mx-auto max-w-(--content-max) px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-20 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
            <div>
              <h1 className="type-display text-[3rem] min-[400px]:text-[3.5rem] sm:text-8xl lg:text-[6.5rem]">
                <span className="block text-balance">{t.home.headline}</span>{" "}
                <em className="block text-balance italic">{t.home.headlineItalic}</em>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">{t.home.lead}</p>
            </div>
            <div className="hidden lg:flex lg:justify-end" aria-hidden="true">
              <Logo variant="hey" height={300} alt="" priority />
            </div>
          </div>

          {/* The start area, full width: the idea box for first-time visitors; "Pick up where you left off"
              (with the idea box folded away) for people coming back. */}
          <div className="mt-12 md:mt-16">
            <StartArea
              welcome={<Suspense fallback={null}><WelcomeBack lang={lang} t={t} /></Suspense>}
              form={ideaForm}
              startNew={t.projectHome.welcome.startNew}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-(--content-max) px-4 py-16 sm:px-6 md:py-24">
        {/* The brand line, where it means most: right above the three small steps. */}
        <h2 id="how" className="type-display text-5xl sm:text-6xl lg:text-7xl">
          {t.home.sloganBig}{" "}
          <span className="relative inline-block whitespace-nowrap">
            <MarkerSwipe />
            <em className="relative italic">{t.home.sloganSmall}</em>
          </span>
        </h2>
        <div className="mt-10 grid items-center gap-10 md:mt-14 md:grid-cols-2 md:gap-16">
          <div className="hidden justify-center md:flex">
            <BrandSymbol name="path" size={260} />
          </div>
          <div>
            {/* What happens, in plain rows: no numbers or arrows, so nothing here looks clickable. */}
            <ul className="border-b border-border">
              {t.home.steps.map((step) => (
                <li key={step.title} className="border-t border-border py-6">
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="mt-1 text-text-muted">{step.body}</p>
                </li>
              ))}
            </ul>
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
        <div className="mx-auto max-w-(--content-max) px-4 py-20 sm:px-6 md:py-28">
          {/* Two balanced halves, so no word is left alone on a line. */}
          <h2 id="features" className="type-display text-5xl sm:text-6xl lg:text-7xl">
            <span className="block text-balance">{t.home.featuresTitle}</span>{" "}
            <em className="block text-balance italic">{t.home.featuresTitleItalic}</em>
          </h2>
          <p className="mt-6 max-w-2xl text-balance text-lg text-text-muted sm:text-xl">{t.home.featuresBody}</p>
          <ul className="mt-10 grid gap-5 md:mt-14 md:grid-cols-3 md:gap-7">
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
        <div className="mx-auto max-w-3xl px-4 pt-20 sm:px-6">
          <SupportCard choices={support} copy={t.support} lang={lang} />
        </div>
      )}

      <section className="mx-auto max-w-(--content-max) px-4 py-20 sm:px-6 md:py-28">
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
