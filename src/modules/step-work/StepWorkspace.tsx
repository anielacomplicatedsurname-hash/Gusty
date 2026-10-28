"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type en from "@/i18n/messages/en.json";
import { setStepDone } from "@/modules/steps/actions";
import { differentQuestions, prepareQuestions, rephraseQuestion, saveAnswer, saveNotes, type WorkResult } from "./actions";
import type { StepWork } from "./data";

type Copy = typeof en.stepWork;
type Status = "idle" | "saving" | "saved" | "failed";

/** One step, worked through with up to three simple questions, an answer box for each, and notes. */
export function StepWorkspace({ work, lang, copy }: { work: StepWork; lang: string; copy: Copy }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const projectHref = `/${lang}/projects/${work.step.projectId}`;

  const act = (run: () => Promise<WorkResult>, busyKey: string) => {
    setError(null);
    setBusy(busyKey);
    startTransition(async () => {
      const result = await run();
      setBusy(null);
      if (result.ok) router.refresh();
      else setError(copy.errors[result.error]);
    });
  };

  // The first visit prepares Gusty's questions; later visits show the saved ones.
  useEffect(() => {
    if (started.current || work.questions.length > 0) return;
    started.current = true;
    act(() => prepareQuestions(work.step.id, lang), "prepare");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await setStepDone(work.step.id, true);
      if (result.ok) router.push(projectHref);
      else setError(copy.errors.failed);
    });
  };

  return (
    <div className="flex flex-col gap-8" aria-busy={pending}>
      {work.demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoNotice}</p>}
      {work.step.status === "done" && <p className="rounded-xl bg-confirmed/60 p-3 text-sm font-medium text-ink">{copy.alreadyDone}</p>}

      <section aria-labelledby="questions-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="questions-title" className="text-xl font-semibold">{copy.questionsTitle}</h2>
          {work.questions.length > 0 && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => act(() => differentQuestions(work.step.id, lang), "different")}>
                {busy === "different" ? copy.rephrasing : copy.different}
              </button>
              <span className="text-xs text-text-muted">{copy.differentHint}</span>
            </div>
          )}
        </div>

        {work.questions.length === 0 && !error && (
          <p role="status" className="flex items-center gap-3 text-text-muted">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-lilac motion-safe:animate-pulse" />
            {copy.preparing}
          </p>
        )}

        <ol className="flex flex-col gap-4">
          {work.questions.map((q, i) => (
            <li key={`${q.id}-${q.question}`} className="rounded-(--radius-card) bg-surface-raised p-5">
              <p className="type-label text-text-muted">{copy.questionsLabel}</p>
              <h3 id={`q-${q.id}`} className="mt-1 text-lg font-semibold">
                <span className="sr-only">{i + 1}. </span>
                {q.question}
              </h3>
              {q.hint && <p id={`h-${q.id}`} className="mt-1 text-text-muted">{q.hint}</p>}
              <button type="button" className="mt-2 text-sm font-medium underline underline-offset-4" disabled={pending}
                onClick={() => act(() => rephraseQuestion(q.id, lang), q.id)}>
                {busy === q.id ? copy.rephrasing : copy.rephrase}
              </button>
              <AutosaveText
                id={`a-${q.id}`}
                label={copy.answerLabel}
                describedBy={`q-${q.id}${q.hint ? ` h-${q.id}` : ""}`}
                initial={q.answer}
                rows={3}
                maxLength={2000}
                save={(text) => saveAnswer(q.id, text)}
                copy={copy}
              />
            </li>
          ))}
        </ol>
        {error && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="font-medium">{error}</p>
            {work.questions.length === 0 && (
              <button type="button" className="btn-secondary" onClick={() => act(() => prepareQuestions(work.step.id, lang), "prepare")}>
                {copy.different}
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="notes-title" className="rounded-(--radius-card) bg-surface-raised p-5">
        <h2 id="notes-title" className="text-xl font-semibold">{copy.notesTitle}</h2>
        <p id="notes-hint" className="mt-1 text-text-muted">{copy.notesHint}</p>
        <AutosaveText id="notes" label={copy.notesTitle} hideLabel describedBy="notes-hint" initial={work.step.notes} rows={6} maxLength={4000}
          save={(text) => saveNotes(work.step.id, text)} copy={copy} />
      </section>

      {work.step.status !== "done" && (
        <div className="flex flex-col items-start gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={finish}>
            {copy.done}
          </button>
          <span className="text-sm text-text-muted">{copy.doneHint}</span>
        </div>
      )}
    </div>
  );
}

/** A text box that saves itself shortly after typing stops, and when it loses focus. */
function AutosaveText({
  id, label, hideLabel = false, describedBy, initial, rows, maxLength, save, copy,
}: {
  id: string; label: string; hideLabel?: boolean; describedBy?: string; initial: string; rows: number; maxLength: number;
  save: (text: string) => Promise<{ ok: boolean }>; copy: Copy;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (text === last.current) return;
    setStatus("saving");
    const result = await save(text);
    if (result.ok) last.current = text;
    setStatus(result.ok ? "saved" : "failed");
  };

  return (
    <div className="mt-3">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block text-sm font-medium"}>{label}</label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-describedby={[describedBy, `${id}-status`].filter(Boolean).join(" ")}
        onChange={(e) => {
          const text = e.target.value;
          setValue(text);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(text), 1200);
        }}
        onBlur={() => void flush(value)}
        className="mt-1 w-full rounded-xl border border-stone bg-paper p-3 text-base"
      />
      <p id={`${id}-status`} data-status={status} aria-live="polite" className="mt-1 h-5 text-sm text-text-muted">
        {status === "saving" ? copy.saving : status === "saved" ? copy.saved : status === "failed" ? copy.errors.failed : ""}
      </p>
    </div>
  );
}
