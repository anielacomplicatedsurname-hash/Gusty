"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FactKind } from "@/ai/tasks/interpret-idea";
import type en from "@/i18n/messages/en.json";
import { addFact, confirmFact, editFact, interpretProject, removeFact, type InterpretResult } from "./actions";
import type { Fact } from "./data";

type Copy = typeof en.interpretation;
type ReadError = Extract<InterpretResult, { ok: false }>["error"];

const STAGES = ["just_an_idea", "planning", "started", "running"] as const;
const SECTIONS: { kind: FactKind; multiple: boolean }[] = [
  { kind: "summary", multiple: false },
  { kind: "audience", multiple: true },
  { kind: "place", multiple: false },
  { kind: "stage", multiple: false },
  { kind: "need", multiple: true },
];

/** Runs Gusty's first reading when the project page opens, then shows it. */
export function AutoRead({ projectId, lang, copy }: { projectId: string; lang: string; copy: Copy }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<ReadError | null>(null);

  async function run() {
    setError(null);
    const result = await interpretProject(projectId, "first", lang);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return error ? (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="font-medium">{copy.errors[error]}</p>
      {error !== "limit" && (
        <button type="button" className="btn-secondary" onClick={() => void run()}>
          {copy.actions.refresh}
        </button>
      )}
    </div>
  ) : (
    <p role="status" className="flex items-center gap-3 text-text-muted">
      <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-lilac motion-safe:animate-pulse" />
      {copy.reading}
    </p>
  );
}

/** Gusty's reading, item by item: confirm, edit, remove or add, with where each came from. */
export function ReadingView({
  projectId,
  lang,
  facts,
  demo,
  copy,
}: {
  projectId: string;
  lang: string;
  facts: Fact[];
  demo: boolean;
  copy: Copy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(run: () => Promise<{ ok: boolean; error?: ReadError }>) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (result.ok) router.refresh();
      else setError(result.error ? copy.errors[result.error] : copy.errors.failed);
    });
  }

  const questions = facts.filter((f) => f.kind === "question");

  return (
    <div className="flex flex-col gap-6" aria-busy={pending}>
      {demo && (
        <p className="rounded-xl bg-sky p-3 text-sm text-ink" data-testid="demo-notice">
          {copy.demoNotice}
        </p>
      )}

      <dl className="flex flex-col gap-5">
        {SECTIONS.map(({ kind, multiple }) => {
          const items = facts.filter((f) => f.kind === kind);
          return (
            <div key={kind} className="border-b border-border pb-5 last:border-0 last:pb-0">
              <dt className="type-label text-text-muted">{copy.sections[kind]}</dt>
              {items.length === 0 && (
                <dd className="mt-2 text-text-muted">{copy.unknown}</dd>
              )}
              {items.map((fact) => (
                <dd key={fact.id} className="mt-2">
                  <FactItem fact={fact} copy={copy} disabled={pending} act={act} />
                </dd>
              ))}
              {(multiple || items.length === 0) && (
                <dd className="mt-2">
                  <AddItem kind={kind} copy={copy} disabled={pending} onAdd={(v) => act(() => addFact(projectId, kind, v))} />
                </dd>
              )}
            </div>
          );
        })}
      </dl>

      {questions.length > 0 && (
        <section aria-labelledby="open-questions" className="rounded-xl bg-paper p-4">
          <h3 id="open-questions" className="type-label text-text-muted">{copy.sections.question}</h3>
          <p className="mt-1 text-sm text-text-muted">{copy.questionsNote}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {questions.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3">
                <span>{q.value}</span>
                <button
                  type="button"
                  className="shrink-0 text-sm font-medium underline underline-offset-4"
                  disabled={pending}
                  onClick={() => act(() => removeFact(q.id))}
                  aria-label={`${copy.actions.remove}: ${q.value}`}
                >
                  {copy.actions.remove}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" className="font-medium">{error}</p>}

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => act(() => interpretProject(projectId, "refresh", lang))}
        >
          {pending ? copy.actions.refreshing : copy.actions.refresh}
        </button>
        <p className="text-sm text-text-muted">{copy.actions.refreshNote}</p>
      </div>
    </div>
  );
}

const chipStyle: Record<Fact["source"], string> = {
  user: "border border-ink/30",
  ai_from_user: "bg-sky",
  ai_suggestion: "bg-lilac",
};

function FactItem({
  fact,
  copy,
  disabled,
  act,
}: {
  fact: Fact;
  copy: Copy;
  disabled: boolean;
  act: (run: () => Promise<{ ok: boolean }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const label = fact.kind === "stage" ? copy.stages[fact.value as keyof Copy["stages"]] ?? fact.value : fact.value;

  if (editing) {
    return (
      <ValueForm
        kind={fact.kind}
        initial={fact.value}
        copy={copy}
        disabled={disabled}
        onCancel={() => setEditing(false)}
        onSave={(value) => {
          setEditing(false);
          act(() => editFact(fact.id, value));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-lg">{label}</span>
        <span className="flex flex-wrap gap-2 text-xs font-medium text-ink">
          <span className={`rounded-full px-2 py-0.5 ${chipStyle[fact.source]}`}>{copy.sources[fact.source]}</span>
          {fact.status === "confirmed" && fact.source !== "user" && (
            <span className="rounded-full bg-sage px-2 py-0.5">✓ {copy.confirmed}</span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        {fact.status !== "confirmed" && (
          <button type="button" className="min-h-6 underline underline-offset-4" disabled={disabled}
            onClick={() => act(() => confirmFact(fact.id))} aria-label={`${copy.actions.confirm}: ${label}`}>
            {copy.actions.confirm}
          </button>
        )}
        <button type="button" className="min-h-6 underline underline-offset-4" disabled={disabled}
          onClick={() => setEditing(true)} aria-label={`${copy.actions.edit}: ${label}`}>
          {copy.actions.edit}
        </button>
        <button type="button" className="min-h-6 underline underline-offset-4" disabled={disabled}
          onClick={() => act(() => removeFact(fact.id))} aria-label={`${copy.actions.remove}: ${label}`}>
          {copy.actions.remove}
        </button>
      </div>
    </div>
  );
}

function AddItem({ kind, copy, disabled, onAdd }: { kind: FactKind; copy: Copy; disabled: boolean; onAdd: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={disabled}
        onClick={() => setOpen(true)} aria-label={`${copy.actions.add}: ${copy.sections[kind]}`}>
        + {copy.actions.add}
      </button>
    );
  }
  return (
    <ValueForm kind={kind} initial="" copy={copy} disabled={disabled} onCancel={() => setOpen(false)}
      onSave={(v) => { setOpen(false); onAdd(v); }} />
  );
}

function ValueForm({
  kind, initial, copy, disabled, onCancel, onSave,
}: {
  kind: FactKind; initial: string; copy: Copy; disabled: boolean; onCancel: () => void; onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial || (kind === "stage" ? STAGES[0] : ""));
  const label = copy.sections[kind];
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value);
      }}
    >
      {kind === "stage" ? (
        <select aria-label={label} value={value} onChange={(e) => setValue(e.target.value)}
          className="h-11 rounded-xl border border-stone bg-paper px-3">
          {STAGES.map((s) => <option key={s} value={s}>{copy.stages[s]}</option>)}
        </select>
      ) : (
        <input aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300}
          placeholder={copy.actions.addPlaceholder} autoFocus
          className="h-11 flex-1 rounded-xl border border-stone bg-paper px-3" />
      )}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary min-h-11 px-4" disabled={disabled || !value.trim()}>
          {copy.actions.save}
        </button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={onCancel}>
          {copy.actions.cancel}
        </button>
      </div>
    </form>
  );
}
