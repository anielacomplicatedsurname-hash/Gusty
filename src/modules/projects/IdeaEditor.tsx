"use client";

import { useEffect, useRef, useState } from "react";
import { saveIdea } from "./actions";
import { IDEA_MAX_LENGTH } from "./validation";

type Status = "idle" | "pending" | "saving" | "saved" | "failed";
const AUTOSAVE_DELAY_MS = 1200;

/**
 * Edits the idea and saves it automatically a moment after typing stops, and when
 * the field loses focus. The latest text is never thrown away if a save fails.
 */
export function IdeaEditor({
  projectId,
  initialIdea,
  copy,
}: {
  projectId: string;
  initialIdea: string;
  copy: { label: string; hint: string; status: Record<Status, string> };
}) {
  const [idea, setIdea] = useState(initialIdea);
  const [status, setStatus] = useState<Status>("idle");
  const savedIdea = useRef(initialIdea);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(text: string) {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim() === savedIdea.current.trim() || !text.trim()) {
      setStatus((s) => (s === "pending" ? "idle" : s));
      return;
    }
    setStatus("saving");
    const result = await saveIdea(projectId, text);
    if (result.ok) {
      savedIdea.current = text;
      setStatus("saved");
    } else {
      setStatus("failed");
    }
  }

  function onChange(text: string) {
    setIdea(text);
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(text), AUTOSAVE_DELAY_MS);
  }

  // Warn before leaving with unsaved text; flush any pending timer on unmount.
  useEffect(() => {
    const unsaved = status === "pending" || status === "saving" || status === "failed";
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsaved) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div>
      <label htmlFor="project-idea" className="block text-lg font-semibold">
        {copy.label}
      </label>
      <p id="project-idea-hint" className="mt-1 text-sm text-text-muted">
        {copy.hint}
      </p>
      <textarea
        id="project-idea"
        value={idea}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => save(idea)}
        rows={8}
        maxLength={IDEA_MAX_LENGTH}
        aria-describedby="project-idea-hint project-idea-status"
        className="mt-3 w-full resize-y rounded-xl border border-stone bg-paper p-3 text-base leading-relaxed"
      />
      <p
        id="project-idea-status"
        role="status"
        aria-live="polite"
        data-status={status}
        className={`mt-2 text-sm ${status === "failed" ? "font-medium text-ink" : "text-text-muted"}`}
      >
        {copy.status[status]}
      </p>
    </div>
  );
}
