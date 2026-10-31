"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fill } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { suggestMoodStep } from "./actions";
import type { Mood } from "./mood";

type Copy = typeof en.steps;

/** When nothing in the stage matches today's mood, Gusty can add one small step of that kind. */
export function SuggestMoodStep({ projectId, mood, lang, copy }: { projectId: string; mood: Mood; lang: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn-secondary" disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const result = await suggestMoodStep(projectId, mood, lang);
          if (result.ok) router.refresh();
          else setError(copy.errors[result.error] ?? copy.errors.error);
        })}>
        {pending ? copy.moodSuggesting : fill(copy.moodSuggest, { mood: copy.moods[mood].toLowerCase() })}
      </button>
      {error && <p role="alert" className="font-medium">{error}</p>}
    </>
  );
}
