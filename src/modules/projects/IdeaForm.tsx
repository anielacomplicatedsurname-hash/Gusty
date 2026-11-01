"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { Dictate } from "@/components/Dictate";
import { createProject, type CreateProjectState } from "./actions";
import { IDEA_MAX_LENGTH } from "./validation";

type Copy = {
  label: string;
  hint: string;
  submit: string;
  pdf: string;
  saving: string;
  privacy: string;
  unavailable: string;
  previewBadge: string;
  errors: Record<NonNullable<CreateProjectState["error"]>, string>;
};

/**
 * The home page's "What's your idea?" box. Saving creates a private project. The page draws the panel
 * around it (see HomeStart). `captcha`: the bot check for first-time visitors, decided on the server (see GuestCaptcha). */
export function IdeaForm({ lang, enabled, copy, captcha }: { lang: string; enabled: boolean; copy: Copy; captcha?: ReactNode }) {
  const [state, action, pending] = useActionState(createProject, {});
  const error = state.error ? copy.errors[state.error] : null;

  return (
    <form action={action} className="p-6 sm:p-8">
      <input type="hidden" name="lang" value={lang} />
      <label htmlFor="idea" className="block text-xl font-semibold">
        {copy.label}
      </label>
      <p id="idea-hint" className="mt-1 text-text-muted">
        {copy.hint}
      </p>
      <textarea
        key={state.attempt ?? 0}
        defaultValue={state.idea ?? ""}
        id="idea"
        name="idea"
        rows={3}
        required
        maxLength={IDEA_MAX_LENGTH}
        aria-describedby={`idea-hint idea-note${error ? " idea-error" : ""}`}
        aria-invalid={error ? true : undefined}
        className="mt-4 w-full resize-y rounded-xl border border-stone bg-paper p-3 text-base leading-relaxed"
      />
      {error && (
        <p id="idea-error" role="alert" className="mt-2 text-sm font-medium text-ink">
          {error}
        </p>
      )}
      {enabled && captcha && <div className="mt-3">{captcha}</div>}
      {/* One row on wide screens: speaking on the left, the two ways in on the right. */}
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>{enabled && <Dictate target="idea" />}</div>
        <div className="flex flex-wrap items-center gap-3 md:mt-2">
          {/* Already working on something? The PDF import lives in My Projects. */}
          {enabled && (
            <Link href={`/${lang}/projects#bring-in`} className="btn-secondary">
              {copy.pdf}
            </Link>
          )}
          <button type="submit" className="btn-primary" disabled={!enabled || pending}>
            {pending ? copy.saving : copy.submit}
            {!pending && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </div>
      <p id="idea-note" className="mt-4 flex items-start gap-2 text-sm text-text-muted">
        {!enabled && (
          <span className="mt-0.5 whitespace-nowrap rounded-full bg-sky px-2 py-0.5 text-xs font-medium text-ink">
            {copy.previewBadge}
          </span>
        )}
        <span>{enabled ? copy.privacy : copy.unavailable}</span>
      </p>
    </form>
  );
}
