"use client";

import { useActionState } from "react";
import { requestEmailLink, type EmailLinkState } from "./actions";

type Copy = {
  label: string;
  submit: string;
  sending: string;
  sent: string;
  signInInstead: string;
  errors: Record<NonNullable<EmailLinkState["error"]>, string>;
};

/** Email a sign-in link: keeps a guest's projects, or signs someone back in. */
export function EmailLinkForm({ lang, copy }: { lang: string; copy: Copy }) {
  const [state, action, pending] = useActionState(requestEmailLink, {});

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-confirmed/60 p-3 text-sm font-medium text-ink">
        {copy.sent}
      </p>
    );
  }

  const error = state.error ? copy.errors[state.error] : null;
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="lang" value={lang} />
      <div className="flex-1">
        <label htmlFor="email" className="block text-sm font-medium">
          {copy.label}
        </label>
        <input
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
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? copy.sending : copy.submit}
      </button>
      {error && (
        <p id="email-error" role="alert" className="text-sm font-medium text-ink sm:basis-full">
          {error}
        </p>
      )}
      {state.error === "exists" && (
        <button type="submit" name="mode" value="signin" className="btn-secondary sm:basis-full sm:self-start" disabled={pending}>
          {copy.signInInstead}
        </button>
      )}
    </form>
  );
}
