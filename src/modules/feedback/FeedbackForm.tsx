"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

type Copy = {
  worked: string;
  confusing: string;
  other: string;
  hint: string;
  submit: string;
  sending: string;
  sent: string;
  errors: Record<NonNullable<FeedbackState["error"]>, string>;
};

/** Three optional questions; any one answer is enough. */
export function FeedbackForm({ page, copy }: { page: string; copy: Copy }) {
  const [state, action, pending] = useActionState(sendFeedback, {});

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-confirmed/60 p-4 font-medium text-ink">
        {copy.sent}
      </p>
    );
  }

  const error = state.error ? copy.errors[state.error] : null;
  const fields = [
    ["worked", copy.worked],
    ["confusing", copy.confusing],
    ["other", copy.other],
  ] as const;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="page" value={page} />
      <p className="text-text-muted">{copy.hint}</p>
      {fields.map(([name, label]) => (
        <div key={name}>
          <label htmlFor={`feedback-${name}`} className="block font-medium">
            {label}
          </label>
          <textarea
            id={`feedback-${name}`}
            name={name}
            rows={3}
            maxLength={2000}
            aria-describedby={error ? "feedback-error" : undefined}
            className="mt-1 w-full rounded-xl border border-stone bg-paper p-3 text-base"
          />
        </div>
      ))}
      {error && (
        <p id="feedback-error" role="alert" className="font-medium text-ink">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? copy.sending : copy.submit}
        </button>
      </div>
    </form>
  );
}
