"use client";

import { useState, useTransition } from "react";
import { setSaved } from "./actions";

/** Save a result to the project (or take it off the saved list). Shows the change straight away. */
export function SaveButton({ id, title, initial, copy }: {
  id: string; title: string; initial: boolean; copy: { save: string; saved: string; unsave: string };
}) {
  const [saved, setLocal] = useState(initial);
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const next = !saved;
    setLocal(next);
    startTransition(async () => {
      const result = await setSaved(id, next);
      if (!result.ok) setLocal(!next);
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" aria-pressed={saved} disabled={pending} onClick={toggle}
        aria-label={`${saved ? copy.unsave : copy.save}: ${title}`}
        className={saved ? "btn-secondary" : "btn-primary"}>
        {saved ? `✓ ${copy.saved}` : copy.save}
      </button>
    </div>
  );
}
