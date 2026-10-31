"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addRouteStep } from "./actions";

/** "Add as a step": puts a funding route's first step into the plan, so it can be acted on. */
export function AddRouteStep({ id, title, lang, copy }: {
  id: string; title: string; lang: string; copy: { addRouteStep: string; routeStepAdded: string };
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  if (added) return <p role="status" className="text-sm font-medium">✓ {copy.routeStepAdded}</p>;
  return (
    <button type="button" className="min-h-6 self-start text-sm font-medium underline underline-offset-4" disabled={pending}
      aria-label={`${copy.addRouteStep}: ${title}`}
      onClick={() => start(async () => {
        const result = await addRouteStep(id, lang);
        if (result.ok) {
          setAdded(true);
          router.refresh();
        }
      })}>
      {copy.addRouteStep}
    </button>
  );
}
