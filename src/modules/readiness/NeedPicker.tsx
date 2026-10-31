"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NEEDS, type Need } from "@/ai/tasks/funding-routes";
import { setFundingNeed } from "./actions";

/** "Roughly how much would it need?": the person's own answer, saved as soon as they choose. */
export function NeedPicker({ projectId, initial, copy }: {
  projectId: string; initial: Need | null; copy: { needLabel: string; needs: Record<Need, string>; needSaved: string; errors: { failed: string } };
}) {
  const router = useRouter();
  const [need, setNeed] = useState<Need | null>(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const choose = (value: Need) => {
    setNeed(value);
    startTransition(async () => {
      const result = await setFundingNeed(projectId, value);
      setStatus(result.ok ? "saved" : "failed");
      if (result.ok) router.refresh();
    });
  };
  return (
    <fieldset id="need" aria-busy={pending}>
      <legend className="font-medium">{copy.needLabel}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {NEEDS.map((n) => (
          <label key={n} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink ${
            need === n ? "border-ink bg-ink text-paper" : "border-border bg-paper text-ink"}`}>
            <input type="radio" name="funding-need" value={n} checked={need === n} onChange={() => choose(n)} className="sr-only" />
            {copy.needs[n]}
          </label>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 h-5 text-sm text-text-muted">
        {status === "saved" ? copy.needSaved : status === "failed" ? copy.errors.failed : ""}
      </p>
    </fieldset>
  );
}
