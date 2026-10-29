"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type en from "@/i18n/messages/en.json";
import { setStepDone } from "@/modules/steps/actions";
import {
  applySayMore, differentQuestions, prepareQuestions, rephraseQuestion, reviseDraft, saveAnswer, saveDraft, saveNotes, sayMore,
  tidyAnswer, tidyNotes, writeDraft, type DraftResult, type WorkResult,
} from "./actions";
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
                onFinished={() => tidyAnswer(q.id)}
                copy={copy}
                sayMore={{ questionId: q.id, assisted: q.assisted, lang }}
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
          save={(text) => saveNotes(work.step.id, text)} onFinished={() => tidyNotes(work.step.id)} copy={copy} />
      </section>

      <WriteIt stepId={work.step.id} initial={work.step.draft} copy={copy} />

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

type Box = { id: string; value: string; replace: (text: string) => void };

/**
 * A text box that saves itself shortly after typing stops, and when it loses focus. `onFinished` runs
 * once the person leaves the box with saved text (Gusty tidies it then, not on every pause in typing).
 */
function AutosaveText({
  id, label, hideLabel = false, describedBy, initial, rows, maxLength, save, onFinished, copy, sayMore,
}: {
  id: string; label: string; hideLabel?: boolean; describedBy?: string; initial: string; rows: number; maxLength: number;
  save: (text: string) => Promise<{ ok: boolean }>; onFinished?: () => Promise<void>; copy: Copy;
  /** Offers "Help me say more" for this answer. */
  sayMore?: { questionId: string; assisted: boolean; lang: string };
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const last = useRef(initial);
  const finished = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (text === last.current) return true;
    setStatus("saving");
    const result = await save(text);
    if (result.ok) last.current = text;
    setStatus(result.ok ? "saved" : "failed");
    return result.ok;
  };

  const finish = async (text: string) => {
    if (!(await flush(text)) || !text.trim() || text === finished.current) return;
    finished.current = text;
    void onFinished?.();
  };

  // "Use this" saves on the server; the box just shows the new text.
  const replace = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setValue(text);
    last.current = text;
    setStatus("saved");
    void finish(text);
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
        onBlur={() => void finish(value)}
        className="mt-1 w-full rounded-xl border border-stone bg-paper p-3 text-base"
      />
      <p id={`${id}-status`} data-status={status} aria-live="polite" className="mt-1 h-5 text-sm text-text-muted">
        {status === "saving" ? copy.saving : status === "saved" ? copy.saved : status === "failed" ? copy.errors.failed : ""}
      </p>
      {sayMore && <SayMore {...sayMore} box={{ id, value, replace }} copy={copy} />}
    </div>
  );
}

/** "Help me say more": Gusty suggests a longer version of the answer; the person chooses whether to use it. */
function SayMore({ questionId, assisted: initiallyAssisted, lang, box, copy }: {
  questionId: string; assisted: boolean; lang: string; box: Box; copy: Copy;
}) {
  const [suggestion, setSuggestion] = useState<{ text: string; demo: boolean } | null>(null);
  const [assisted, setAssisted] = useState(initiallyAssisted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = copy.sayMore;

  const ask = () => {
    setError(null);
    startTransition(async () => {
      const result = await sayMore(questionId, box.value, lang);
      if (result.ok) setSuggestion({ text: result.text, demo: result.demo });
      else setError(copy.errors[result.error]);
    });
  };

  const use = (text: string) => {
    setError(null);
    startTransition(async () => {
      const result = await applySayMore(questionId, text);
      if (!result.ok) return setError(copy.errors.failed);
      box.replace(text);
      setSuggestion(null);
      setAssisted(true);
      document.getElementById(box.id)?.focus();
    });
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {assisted && <p className="text-sm text-text-muted">{t.assisted}</p>}
      {!suggestion && box.value.trim() && (
        <button type="button" className="btn-secondary" disabled={pending} onClick={ask}>
          {pending ? t.working : t.button}
        </button>
      )}
      {error && <p role="alert" className="text-sm font-medium">{error}</p>}
      <div aria-live="polite" className="w-full">
        {suggestion && (
          <section aria-labelledby={`${box.id}-suggestion`} className="flex flex-col gap-3 rounded-xl border-2 border-lilac bg-paper p-4">
            <div>
              <h4 id={`${box.id}-suggestion`} className="font-semibold">{t.label}</h4>
              <p className="text-sm text-text-muted">{t.hint}</p>
            </div>
            {suggestion.demo && <p className="rounded-lg bg-sky p-2 text-sm text-ink">{t.demoNotice}</p>}
            <p className="whitespace-pre-line">{suggestion.text}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={pending} onClick={() => use(suggestion.text)}>{t.use}</button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => setSuggestion(null)}>{t.keep}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const REVISIONS = ["shorter", "simpler", "warmer"] as const;

/**
 * "Help me summarise it": Gusty sums up the answers and notes for this step. The summary is a
 * suggestion until the person keeps it; after that it's theirs to change, still marked as started by Gusty.
 */
function WriteIt({ stepId, initial, copy }: { stepId: string; initial: string; copy: Copy }) {
  const t = copy.write;
  const [saved, setSaved] = useState(initial);
  const [version, setVersion] = useState(0);
  const [suggestion, setSuggestion] = useState<{ text: string; demo: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(initial);

  const run = (key: string, call: () => Promise<DraftResult>) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await call();
      setBusy(null);
      if (result.ok) setSuggestion({ text: result.text, demo: result.demo });
      else setError(result.error === "empty" ? t.needsAnswers : copy.errors[result.error]);
    });
  };

  const keep = (text: string) => {
    setError(null);
    startTransition(async () => {
      const result = await saveDraft(stepId, text);
      if (!result.ok) return setError(copy.errors.failed);
      latest.current = text;
      setSaved(text);
      setVersion((v) => v + 1);
      setSuggestion(null);
    });
  };

  const label = (key: string, text: string) => (busy === key ? t.working : text);

  return (
    <section aria-labelledby="write-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5">
      <div>
        <h2 id="write-title" className="text-xl font-semibold">{t.title}</h2>
        <p className="mt-1 text-text-muted">{t.intro}</p>
      </div>

      {saved.trim() && (
        <div>
          <AutosaveText key={version} id="draft" label={t.yours} describedBy="draft-hint" initial={saved} rows={8} maxLength={4000}
            save={(text) => { latest.current = text; return saveDraft(stepId, text); }} copy={copy} />
          <p id="draft-hint" className="-mt-1 text-sm text-text-muted">{t.yoursHint}</p>
          {!suggestion && (
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t.changeIt}>
              {REVISIONS.map((k) => (
                <button key={k} type="button" className="btn-secondary min-h-11 px-4 text-sm" disabled={pending}
                  onClick={() => run(k, () => reviseDraft(stepId, latest.current, k))}>
                  {label(k, t[k])}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!suggestion && (
        <button type="button" className={`${saved.trim() ? "btn-secondary" : "btn-primary"} self-start`} disabled={pending}
          onClick={() => run("write", () => writeDraft(stepId))}>
          {label("write", saved.trim() ? t.again : t.button)}
        </button>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}

      <div aria-live="polite">
        {suggestion && (
          <section aria-labelledby="draft-suggestion" className="flex flex-col gap-3 rounded-xl border-2 border-lilac bg-paper p-4">
            <div>
              <h3 id="draft-suggestion" className="font-semibold">{t.suggestion}</h3>
              <p className="text-sm text-text-muted">{t.suggestionHint}</p>
            </div>
            {suggestion.demo && <p className="rounded-lg bg-sky p-2 text-sm text-ink">{t.demoNotice}</p>}
            <p className="whitespace-pre-line">{suggestion.text}</p>
            <div className="flex flex-wrap gap-2">
              {REVISIONS.map((k) => (
                <button key={k} type="button" className="btn-secondary min-h-11 px-4 text-sm" disabled={pending}
                  onClick={() => run(k, () => reviseDraft(stepId, suggestion.text, k))}>
                  {label(k, t[k])}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={pending} onClick={() => keep(suggestion.text)}>
                {saved.trim() ? t.useVersion : t.keep}
              </button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => setSuggestion(null)}>{t.notNow}</button>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
