"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A destructive action that asks once before acting, in place (no pop-up). Renders inside a form
 * whose action does the work.
 */
export function ConfirmButton({ label, confirmText, confirmLabel, cancelLabel }: {
  label: string;
  confirmText: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const [asking, setAsking] = useState(false);
  const { pending } = useFormStatus();
  if (!asking) {
    return (
      <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3 rounded-xl border border-ink p-4">
      <p className="font-medium">{confirmText}</p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn-primary min-h-11" disabled={pending}>
          {confirmLabel}
        </button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setAsking(false)}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
