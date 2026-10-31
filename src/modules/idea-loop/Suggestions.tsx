"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { acceptSuggestion, dismissSuggestion } from "./actions";
import type { FactSuggestion } from "./data";

/**
 * Gusty's suggested updates to the idea, from steps the person has finished. Nothing changes until they
 * choose "Use this"; "Not now" simply puts the suggestion away.
 */
export function Suggestions({ items, labels, copy }: {
  items: FactSuggestion[]; labels: Record<string, string>; copy: Messages["ideaLoop"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (items.length === 0) return null;

  const act = (fn: (id: string) => Promise<{ ok: boolean }>, id: string) =>
    start(async () => {
      const { ok } = await fn(id);
      setFailed(!ok);
      router.refresh();
    });

  return (
    <section aria-labelledby="suggestions-title" className="flex flex-col gap-3 rounded-xl bg-oat p-4 text-ink">
      <div>
        <h3 id="suggestions-title" className="font-semibold">{copy.title}</h3>
        <p className="text-sm">{copy.intro}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-lg bg-paper p-3">
            <p>
              <span className="font-semibold">{labels[s.kind] ?? s.kind}:</span> {s.value}
            </p>
            <p className="text-sm text-text-muted">
              {[s.stepTitle ? fill(copy.from, { step: s.stepTitle }) : null, s.reason || null].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-text-muted">{copy.label}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={pending}
                aria-label={`${copy.use}: ${labels[s.kind] ?? s.kind}`} onClick={() => act(acceptSuggestion, s.id)}>
                {copy.use}
              </button>
              <button type="button" className="btn-secondary" disabled={pending}
                aria-label={`${copy.notNow}: ${labels[s.kind] ?? s.kind}`} onClick={() => act(dismissSuggestion, s.id)}>
                {copy.notNow}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {failed && <p role="status" className="text-sm">{copy.error}</p>}
    </section>
  );
}
