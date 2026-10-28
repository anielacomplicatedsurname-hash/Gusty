"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UnstickKind } from "@/ai/tasks/steps";
import { fill } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import {
  addOwnStep, chooseDirection, removeStep, setMode, setStepDone, suggestDirections, suggestMoreSteps, unstick,
  type StepsResult,
} from "./actions";
import type { DirectionView } from "./data";
import { MODES, visibleSteps, type Mode, type StepView } from "./modes";

type Copy = typeof en.steps;
type Act = (run: () => Promise<StepsResult | { ok: boolean }>, busyText?: string) => void;

/** "Your next steps": directions, small steps shown by experience mode, and help when stuck. */
export function NextSteps({
  projectId,
  lang,
  directions,
  steps,
  initialMode,
  demo,
  copy,
}: {
  projectId: string;
  lang: string;
  directions: DirectionView[];
  steps: StepView[];
  initialMode: Mode;
  demo: boolean;
  copy: Copy;
}) {
  const router = useRouter();
  const [mode, setLocalMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();
  const [busyText, setBusyText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const act: Act = (run, text) => {
    setError(null);
    setBusyText(text ?? null);
    startTransition(async () => {
      const result = await run();
      setBusyText(null);
      if (result.ok) {
        setChanging(false);
        router.refresh();
      } else {
        setError("error" in result ? copy.errors[result.error] : copy.errors.failed);
      }
    });
  };

  const chosen = directions.find((d) => d.chosen) ?? null;
  const view = visibleSteps(steps, mode);
  const showDirections = directions.length > 0 && (!chosen || changing);

  return (
    <div className="flex flex-col gap-6" aria-busy={pending}>
      <ModeSwitch
        mode={mode}
        copy={copy}
        onChange={(m) => {
          setLocalMode(m);
          void setMode(m);
        }}
      />

      {demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}

      {directions.length === 0 && (
        <button type="button" className="btn-primary self-start" disabled={pending}
          onClick={() => act(() => suggestDirections(projectId, lang), copy.starting)}>
          {copy.start}
        </button>
      )}

      {showDirections && (
        <section aria-labelledby="directions-title" className="flex flex-col gap-3">
          <h3 id="directions-title" className="text-lg font-semibold">{copy.directionsTitle}</h3>
          <p className="text-sm text-text-muted">{copy.directionsIntro}</p>
          <ul className="flex flex-col gap-3">
            {directions.map((d) => (
              <li key={d.id} className={`rounded-xl border p-4 ${d.recommended ? "border-ink" : "border-border"}`}>
                {d.recommended && (
                  <p className="mb-1 text-xs font-medium">
                    <span className="rounded-full bg-signal px-2 py-0.5 text-ink">{copy.recommended}</span>
                  </p>
                )}
                <p className="text-lg font-semibold">{d.label}</p>
                {d.reason && <p className="mt-1 text-text-muted">{d.reason}</p>}
                <button type="button" className={`${d.recommended ? "btn-primary" : "btn-secondary"} mt-3 min-h-11`}
                  disabled={pending} aria-label={`${copy.choose}: ${d.label}`}
                  onClick={() => act(() => chooseDirection(projectId, d.id, lang), copy.planning)}>
                  {copy.choose}
                </button>
              </li>
            ))}
          </ul>
          {chosen && (
            <button type="button" className="self-start text-sm font-medium underline underline-offset-4"
              onClick={() => setChanging(false)}>
              {copy.cancel}
            </button>
          )}
        </section>
      )}

      {busyText && (
        <p role="status" className="flex items-center gap-3 text-text-muted">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-lilac motion-safe:animate-pulse" />
          {busyText}
        </p>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}

      {chosen && !showDirections && (
        <>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="type-label text-text-muted">{copy.chosen}</span>
            <span className="font-semibold">{chosen.label}</span>
            <button type="button" className="text-sm font-medium underline underline-offset-4"
              onClick={() => setChanging(true)}>
              {copy.change}
            </button>
          </p>

          {view.current ? (
            <ol className="flex flex-col gap-3" aria-label={copy.title}>
              {/* Keyed by step so a tick never carries over to the step that moves into this place. */}
              <li key={view.current.id}><StepCard step={view.current} highlighted projectId={projectId} lang={lang} copy={copy} act={act} disabled={pending} /></li>
              {view.upcoming.map((s) => (
                <li key={s.id}><StepCard step={s} projectId={projectId} lang={lang} copy={copy} act={act} disabled={pending} /></li>
              ))}
            </ol>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p>{copy.allDone}</p>
              <button type="button" className="btn-primary" disabled={pending}
                onClick={() => act(() => suggestMoreSteps(projectId, lang), copy.planning)}>
                {copy.more}
              </button>
            </div>
          )}

          {view.hiddenCount > 0 && (
            <p className="text-sm text-text-muted">{fill(copy.moreHidden, { n: String(view.hiddenCount) })}</p>
          )}

          {mode !== "simple" && <AddStep copy={copy} disabled={pending} onAdd={(t) => act(() => addOwnStep(projectId, t))} />}

          {view.doneCount > 0 && mode !== "everything" && (
            <p className="text-sm text-text-muted">✓ {fill(copy.doneCount, { n: String(view.doneCount) })}</p>
          )}
          {view.done.length > 0 && (
            <section aria-labelledby="done-title">
              <h3 id="done-title" className="type-label text-text-muted">{copy.doneLabel}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {view.done.map((s) => (
                  <DoneItem key={s.id} step={s} copy={copy} disabled={pending} act={act} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ModeSwitch({ mode, copy, onChange }: { mode: Mode; copy: Copy; onChange: (m: Mode) => void }) {
  return (
    <fieldset>
      <legend className="type-label mb-2 text-text-muted">{copy.modes.label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <label key={m}
            className={`flex min-h-12 cursor-pointer flex-col justify-center rounded-xl border px-2 py-2 text-center text-sm leading-tight sm:px-3 sm:text-left sm:text-base has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink ${
              mode === m ? "border-ink bg-ink text-paper" : "border-border bg-paper text-ink"
            }`}>
            <input type="radio" name="experience-mode" value={m} checked={mode === m}
              onChange={() => onChange(m)} className="sr-only" />
            <span className="font-medium">{copy.modes[m]}</span>
            <span className={`hidden text-xs sm:block ${mode === m ? "text-paper/85" : "text-text-muted"}`}>
              {copy.modes[`${m}Hint` as const]}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-text-muted sm:hidden" aria-hidden="true">{copy.modes[`${mode}Hint` as const]}</p>
    </fieldset>
  );
}

function StepCard({
  step, highlighted = false, projectId, lang, copy, act, disabled,
}: {
  step: StepView; highlighted?: boolean; projectId: string; lang: string; copy: Copy; act: Act; disabled: boolean;
}) {
  const [stuckOpen, setStuckOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Show the tick straight away; the list updates once the change is saved.
  const [ticked, setTicked] = useState(false);
  const help = (kind: UnstickKind) => {
    setStuckOpen(false);
    act(() => unstick(step.id, kind, lang), copy.stuck.working);
  };

  return (
    <article className={`rounded-xl p-4 ${highlighted ? "bg-signal text-ink" : "border border-border"}`}>
      {highlighted && <p className="type-label mb-2">{copy.startHere}</p>}
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={ticked} disabled={disabled} className="mt-1 h-5 w-5 shrink-0 accent-ink"
          aria-label={`${copy.markDone}: ${step.title}`}
          onChange={() => { setTicked(true); act(() => setStepDone(step.id, true)); }} />
        <div className="flex-1">
          <h4 className="text-lg font-semibold">{step.title}</h4>
          {step.detail && <p className={`mt-1 ${highlighted ? "" : "text-text-muted"}`}>{step.detail}</p>}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {step.minutes && <span>{fill(copy.minutes, { n: String(step.minutes) })}</span>}
            {step.source === "user" && <span className="font-medium">{copy.yours}</span>}
          </p>
        </div>
      </div>

      {step.explanation && (
        <div className="mt-3 rounded-lg bg-paper p-3 text-ink">
          <p className="type-label">{copy.explanationTitle}</p>
          <p className="mt-1">{step.explanation}</p>
        </div>
      )}
      {step.starter && (
        <div className="mt-3 rounded-lg bg-paper p-3 text-ink">
          <p className="type-label">{copy.starterTitle}</p>
          <p className="mt-1 whitespace-pre-line">{step.starter}</p>
          <button type="button" className="mt-2 text-sm font-medium underline underline-offset-4"
            onClick={() => { void navigator.clipboard?.writeText(step.starter ?? ""); setCopied(true); }}>
            {copied ? copy.copied : copy.copy}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        <Link href={`/${lang}/projects/${projectId}/steps/${step.id}`} aria-label={`${copy.workOn}: ${step.title}`}
          className={highlighted ? "btn-primary" : "underline underline-offset-4"}>
          {copy.workOn}
        </Link>
        <button type="button" className="underline underline-offset-4" disabled={disabled}
          aria-expanded={stuckOpen} onClick={() => setStuckOpen((o) => !o)}>
          {copy.stuck.button}
        </button>
        {!highlighted && (
          <button type="button" className="underline underline-offset-4" disabled={disabled}
            aria-label={`${copy.remove}: ${step.title}`} onClick={() => act(() => removeStep(step.id))}>
            {copy.remove}
          </button>
        )}
      </div>
      {stuckOpen && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-paper p-3 text-ink" role="group" aria-label={copy.stuck.title}>
          <p className="font-medium">{copy.stuck.title}</p>
          <div className="flex flex-wrap gap-2">
            {(["smaller", "explain", "start"] as const).map((k) => (
              <button key={k} type="button" className="btn-secondary min-h-11 px-4 text-sm" disabled={disabled}
                onClick={() => help(k)}>
                {copy.stuck[k]}
              </button>
            ))}
          </div>
          <button type="button" className="self-start text-sm underline underline-offset-4" onClick={() => setStuckOpen(false)}>
            {copy.stuck.close}
          </button>
        </div>
      )}
    </article>
  );
}

function AddStep({ copy, disabled, onAdd }: { copy: Copy; disabled: boolean; onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button type="button" className="self-start text-sm font-medium underline underline-offset-4" onClick={() => setOpen(true)}>
        + {copy.addOwn}
      </button>
    );
  }
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) { onAdd(value); setValue(""); setOpen(false); } }}>
      <input aria-label={copy.addOwn} value={value} onChange={(e) => setValue(e.target.value)} maxLength={160}
        placeholder={copy.addPlaceholder} autoFocus className="h-11 flex-1 rounded-xl border border-stone bg-paper px-3" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary min-h-11 px-4" disabled={disabled || !value.trim()}>{copy.add}</button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setOpen(false)}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}

function DoneItem({ step, copy, disabled, act }: { step: StepView; copy: Copy; disabled: boolean; act: Act }) {
  const [unticked, setUnticked] = useState(false);
  return (
    <li className="flex items-start gap-3">
      <input type="checkbox" checked={!unticked} disabled={disabled}
        className="mt-1 h-5 w-5 accent-ink" aria-label={`${copy.markNotDone}: ${step.title}`}
        onChange={() => { setUnticked(true); act(() => setStepDone(step.id, false)); }} />
      <span className="text-text-muted line-through decoration-1">{step.title}</span>
    </li>
  );
}
