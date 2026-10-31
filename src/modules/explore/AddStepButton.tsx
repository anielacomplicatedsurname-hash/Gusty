"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCheckStep } from "./actions";

/** Adds "Check whether you can apply: …" as a step in the project's current stage. */
export function AddStepButton({ id, title, lang, copy }: { id: string; title: string; lang: string; copy: { addStep: string; stepAdded: string } }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  if (added) return <p role="status" className="text-sm font-medium">✓ {copy.stepAdded}</p>;
  return (
    <button type="button" className="self-start text-sm font-medium underline underline-offset-4" disabled={pending}
      aria-label={`${copy.addStep}: ${title}`}
      onClick={() => startTransition(async () => {
        const result = await addCheckStep(id, lang);
        if (result.ok) {
          setAdded(true);
          router.refresh();
        }
      })}>
      {copy.addStep}
    </button>
  );
}
