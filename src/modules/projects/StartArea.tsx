"use client";

import { useState, type ReactNode } from "react";

/** The wide white panel the home page's start area sits in. */
export function StartPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-border bg-surface-raised shadow-[0_1px_0_rgba(17,17,17,0.04)]">
      {children}
    </div>
  );
}

/**
 * The home page's start area: one clear thing at a time.
 * - First time: just the idea box.
 * - Coming back: `welcome` ("Pick up where you left off", streamed in by the server, marked
 *   data-returning) and the idea box folded away behind "Start something new".
 * The idea box itself is always the same element, never swapped, so nothing typed is ever lost.
 */
export function StartArea({ welcome, form, startNew }: { welcome: ReactNode; form: ReactNode; startNew: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group/start flex flex-col gap-4">
      {welcome}
      <button type="button" aria-expanded={open} aria-controls="start-new" onClick={() => setOpen((o) => !o)}
        className="hidden min-h-11 items-center gap-2 self-start px-1 font-medium group-has-[[data-returning]]/start:inline-flex">
        <span aria-hidden="true" className={`inline-block text-lg leading-none transition-transform duration-(--duration) ${open ? "rotate-45" : ""}`}>+</span>
        <span className="underline underline-offset-4">{startNew}</span>
      </button>
      {/* Someone who starts typing before "Pick up where you left off" arrives keeps the box open. */}
      <div id="start-new" onFocus={() => setOpen(true)} className={open ? "" : "group-has-[[data-returning]]/start:hidden"}>
        <StartPanel>{form}</StartPanel>
      </div>
    </div>
  );
}
