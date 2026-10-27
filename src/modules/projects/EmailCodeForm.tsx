"use client";

import { useActionState } from "react";
import { verifyEmailCode, type EmailCodeState } from "./actions";

type Copy = {
  label: string;
  hint: string;
  submit: string;
  checking: string;
  errors: Record<NonNullable<EmailCodeState["error"]>, string>;
};

/** The code from the sign-in email, typed here instead of opening the link. */
export function EmailCodeForm({ lang, email, type, copy }: { lang: string; email: string; type: string; copy: Copy }) {
  const [state, action, pending] = useActionState(verifyEmailCode, {});
  const error = state.error ? copy.errors[state.error] : null;

  return (
    <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="type" value={type} />
      <div className="flex-1">
        <label htmlFor="email-code" className="block text-sm font-medium">
          {copy.label}
        </label>
        <p id="email-code-hint" className="text-sm text-text-muted">
          {copy.hint}
        </p>
        <input
          id="email-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-code-hint email-code-error" : "email-code-hint"}
          className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3 text-lg tracking-[0.3em]"
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? copy.checking : copy.submit}
      </button>
      {error && (
        <p id="email-code-error" role="alert" className="text-sm font-medium text-ink sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
