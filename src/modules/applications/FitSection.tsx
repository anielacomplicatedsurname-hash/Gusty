"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import type { FitLevel } from "@/ai/tasks/application-fit";
import { fill, formatDate } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { refreshFit } from "./actions";
import type { Application } from "./data";

type Copy = typeof en.applications;

const LIGHTS: { level: FitLevel; colour: string }[] = [
  { level: "weak", colour: "bg-(--status-old)" },
  { level: "some", colour: "bg-(--status-aging)" },
  { level: "strong", colour: "bg-(--status-fresh)" },
];

/** A traffic light for the overall fit: colour, position and words together, so it never relies on colour. */
function FitLight({ level, copy }: { level: FitLevel; copy: Copy }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border p-4">
      <span aria-hidden="true" className="flex shrink-0 flex-col gap-1.5 rounded-full bg-ink p-2">
        {LIGHTS.map((l) => (
          <span key={l.level} className={`block size-4 rounded-full ${l.level === level ? l.colour : "bg-paper/25"}`} />
        ))}
      </span>
      <span className="flex flex-col">
        <span className="text-lg font-semibold">{copy.levels[level].title}</span>
        <span className="text-sm text-text-muted">{copy.levels[level].body}</span>
      </span>
    </div>
  );
}

/** Gusty's view of how the project fits this funder: a light, what matches, and what to add. */
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
          {fit.level && <FitLight level={fit.level} copy={copy} />}
          <p className="text-lg leading-relaxed">{fit.summary}</p>
          {fit.strengths.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.strengthsTitle}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {fit.strengths.map((s) => (
                  <li key={s.point} className="flex items-start gap-3 rounded-xl border-l-4 border-[color:var(--status-fresh)] bg-paper p-3">
                    <span aria-hidden="true" className="font-bold">✓</span>
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
                  <li key={g.point} className="flex items-start gap-3 rounded-xl border-l-4 border-[color:var(--status-aging)] bg-paper p-3">
                    <span aria-hidden="true" className="font-bold">→</span>
                    <span>{g.point}{g.suggestion && <span className="mt-1 block text-sm">{g.suggestion}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fit.words.length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">{copy.wordsTitle}</summary>
              <div className="flex flex-col gap-3 border-t border-border p-4">
                <p className="text-sm text-text-muted">{copy.wordsIntro}</p>
                <dl className="flex flex-col gap-3">
                  {fit.words.map((w) => (
                    <div key={w.theirs} className="rounded-xl bg-paper p-3">
                      <dt><span className="type-label mr-2 text-text-muted">{copy.theirs}</span>“{w.theirs}”</dt>
                      <dd className="mt-1"><span className="type-label mr-2 text-text-muted">{copy.yours}</span>{w.yours}</dd>
                    </div>
                  ))}
                </dl>
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
