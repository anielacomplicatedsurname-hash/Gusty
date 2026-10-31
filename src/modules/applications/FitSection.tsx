"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { fill, formatDate } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { refreshFit } from "./actions";
import type { Application } from "./data";

type Copy = typeof en.applications;

/** Gusty's view of how the project fits this funder: matches, gaps, their words your way, rules to check. */
export function FitSection({ app, lang, copy }: { app: Application; lang: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const running = app.fitStatus === "running";

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [running, router]);

  if (app.materials.length === 0) return null;
  const fit = app.fit;
  const again = (
    <button type="button" className="btn-secondary self-start" disabled={pending || running}
      onClick={() => start(async () => { await refreshFit(app.id, lang); router.refresh(); })}>
      {copy.fitAgain}
    </button>
  );

  return (
    <section aria-labelledby="fit-title" className="flex flex-col gap-5 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <h2 id="fit-title" className="text-xl font-semibold">{copy.fitTitle}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.fitIntro}</p>
      </div>
      {running && (
        <p role="status" className="flex items-start gap-3 rounded-xl bg-paper p-4">
          <span aria-hidden="true" className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {copy.fitRunning}
        </p>
      )}
      {!running && app.fitStatus === "failed" && (
        <div className="flex flex-col gap-2"><p role="status" className="font-medium">{copy.fitFailed}</p>{again}</div>
      )}
      {fit && !running && (
        <>
          {fit.demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoFitNotice}</p>}
          <p className="text-lg leading-relaxed">{fit.summary}</p>
          {fit.strengths.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.strengthsTitle}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {fit.strengths.map((s) => (
                  <li key={s.point} className="flex items-start gap-2">
                    <span aria-hidden="true">✦</span>
                    <span>{s.point}{s.from && <span className="block text-sm text-text-muted">{s.from}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fit.gaps.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.gapsTitle}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {fit.gaps.map((g) => (
                  <li key={g.point} className="rounded-xl bg-oat p-3 text-ink">
                    <p>{g.point}</p>
                    {g.suggestion && <p className="mt-1 text-sm">→ {g.suggestion}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(fit.words.length > 0 || fit.check.length > 0) && (
            <details className="rounded-xl border border-border">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">{copy.moreFit}</summary>
              <div className="flex flex-col gap-5 border-t border-border p-4">
          {fit.words.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.wordsTitle}</h3>
              <p className="text-sm text-text-muted">{copy.wordsIntro}</p>
              <dl className="mt-2 flex flex-col gap-3">
                {fit.words.map((w) => (
                  <div key={w.theirs} className="rounded-xl border border-border p-3">
                    <dt><span className="type-label mr-2 text-text-muted">{copy.theirs}</span>“{w.theirs}”</dt>
                    <dd className="mt-1"><span className="type-label mr-2 text-text-muted">{copy.yours}</span>{w.yours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {fit.check.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.checkTitle}</h3>
              <p className="text-sm text-text-muted">{copy.checkIntro}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {fit.check.map((c) => (
                  <li key={c.rule}><p className="font-medium">{c.rule}</p>{c.why && <p className="text-sm">{c.why}</p>}</li>
                ))}
              </ul>
            </div>
          )}
              </div>
            </details>
          )}
          {app.fitAt && <p className="text-sm text-text-muted">{fill(copy.fitLabel, { date: formatDate(app.fitAt, lang) })}</p>}
          <div className="flex flex-col gap-1"><p className="text-sm text-text-muted">{copy.fitAgainHint}</p>{again}</div>
        </>
      )}
    </section>
  );
}
