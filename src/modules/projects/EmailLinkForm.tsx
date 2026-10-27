"use client";

import { useActionState, useRef, useState } from "react";
import { requestEmailLink, type EmailLinkState } from "./actions";

type Copy = {
  label: string;
  submit: string;
  sending: string;
  sent: string;
  sentBring: string;
  welcomeBack: { title: string; body: string; bring: string; different: string };
  errors: Record<Exclude<NonNullable<EmailLinkState["error"]>, "exists">, string>;
};

/** Email a sign-in link: keeps a guest's projects, or signs someone back in. */
export function EmailLinkForm({ lang, copy }: { lang: string; copy: Copy }) {
  const [state, action, pending] = useActionState(requestEmailLink, {});
  // "Use a different email" hides the welcome-back choice for the answer it belongs to.
  const [dismissed, setDismissed] = useState<EmailLinkState | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  if (state.status) {
    return (
      <p role="status" className="rounded-xl bg-confirmed/60 p-3 text-sm font-medium text-ink">
        {state.status === "sentBring" ? copy.sentBring : copy.sent}
      </p>
    );
  }

  const welcomeBack = state.error === "exists" && dismissed !== state;
  const error = state.error && state.error !== "exists" ? copy.errors[state.error] : null;

  function chooseDifferentEmail() {
    setDismissed(state);
    if (emailInput.current) {
      emailInput.current.value = "";
      emailInput.current.focus();
    }
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="lang" value={lang} />
      <div className="flex-1">
        <label htmlFor="email" className="block text-sm font-medium">
          {copy.label}
        </label>
        <input
          ref={emailInput}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
          className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3 text-base"
        />
      </div>
      {!welcomeBack && (
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? copy.sending : copy.submit}
        </button>
      )}
      {error && (
        <p id="email-error" role="alert" className="text-sm font-medium text-ink sm:basis-full">
          {error}
        </p>
      )}
      {welcomeBack && (
        <div role="status" className="mt-2 flex flex-col gap-3 rounded-xl bg-sky/60 p-4 text-ink sm:basis-full">
          <p className="text-lg font-semibold">{copy.welcomeBack.title}</p>
          <p>{copy.welcomeBack.body}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" name="mode" value="bring" className="btn-primary" disabled={pending}>
              {pending ? copy.sending : copy.welcomeBack.bring}
            </button>
            <button type="button" className="btn-secondary" onClick={chooseDifferentEmail} disabled={pending}>
              {copy.welcomeBack.different}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
