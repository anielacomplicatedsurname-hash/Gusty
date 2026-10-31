import { Suspense } from "react";
import { BrandSymbol, type SymbolName } from "@/components/BrandSymbol";
import { Logo } from "@/components/Logo";
import { getMessages } from "@/i18n/dictionaries";
import { WelcomeBack } from "@/modules/projects/WelcomeBack";
import { supportChoices } from "@/config/support";
import { supabaseConfig } from "@/lib/supabase/config";
import { IdeaForm } from "@/modules/projects/IdeaForm";
import { SupportCard } from "@/modules/support/SupportCard";

const stepSymbols: SymbolName[] = ["sprout", "spark", "path"];

function HandUnderline({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[5px] w-16 -rotate-3 rounded-full bg-ink ${className}`}
    />
  );
}

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
      <section className="mx-auto grid max-w-(--content-max) gap-10 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-20">
        <div>
          <Suspense fallback={null}>
            <WelcomeBack lang={lang} t={t} />
          </Suspense>
          <h1 className="type-display text-[3.75rem] sm:text-8xl lg:text-[6.5rem]">
            {t.home.headline}{" "}
            <br />
            <em className="italic">{t.home.headlineItalic}</em>
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

        <div className="hidden lg:block" aria-hidden="true">
          <Logo variant="hey" height={300} alt="" priority />
        </div>
      </section>

      <section aria-labelledby="how" className="bg-oat/60">
        <div className="mx-auto max-w-(--content-max) px-4 py-14 sm:px-6">
          <p className="type-label text-text-muted">{t.home.howTitle}</p>
          {/* The brand line, where it means most: right above the three small steps. */}
          <h2 id="how" className="type-marker mb-4 mt-3 text-4xl sm:text-5xl">
            {t.home.sloganBig}{" "}
            <span className="relative inline-block whitespace-nowrap">
              <MarkerSwipe />
              <span className="relative">{t.home.sloganSmall}</span>
            </span>
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

      {support && (
        <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <SupportCard choices={support} copy={t.support} lang={lang} />
        </div>
      )}

      <section className="mx-auto max-w-(--content-max) px-4 py-16 text-center sm:px-6">
        <p className="type-display text-5xl sm:text-6xl">{t.home.closing}</p>
        <HandUnderline className="mx-auto mt-4" />
      </section>
    </>
  );
}
