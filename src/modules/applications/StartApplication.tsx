"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type en from "@/i18n/messages/en.json";
import { applicationFromSaved, createApplication } from "./actions";

type Copy = typeof en.applications;

/** Starts an application space for something the person found themselves. */
export function StartApplication({ projectId, lang, copy }: { projectId: string; lang: string; copy: Copy }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [funder, setFunder] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="btn-secondary self-start" onClick={() => setOpen(true)}>{copy.start}</button>;
  return (
    <form className="flex flex-col gap-3 rounded-xl border border-border p-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setError(null);
        const result = await createApplication(projectId, title, funder, url);
        if (!result.ok) return setError(copy.errors[result.error]);
        setOpen(false);
        setTitle("");
        setFunder("");
        setUrl("");
        router.push(`/${lang}/projects/${projectId}/apply/${result.id}`);
      });
    }}>
      <div>
        <label htmlFor="app-title" className="block font-medium">{copy.titleLabel}</label>
        <p id="app-title-hint" className="text-sm text-text-muted">{copy.titleHint}</p>
        <input id="app-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-describedby="app-title-hint"
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      <div>
        <label htmlFor="app-funder" className="block font-medium">{copy.funderLabel}</label>
        <input id="app-funder" value={funder} onChange={(e) => setFunder(e.target.value)} maxLength={200}
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      <div>
        <label htmlFor="app-url" className="block font-medium">{copy.urlLabel}</label>
        <input id="app-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} placeholder="https://"
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !title.trim()}>{pending ? copy.creating : copy.create}</button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setOpen(false)}>{copy.cancel}</button>
      </div>
      {error && <p role="alert" className="font-medium">{error}</p>}
    </form>
  );
}

/** From a saved opportunity: opens its application space, creating it the first time. */
export function PrepareButton({ foundId, title, projectId, lang, label }: {
  foundId: string; title: string; projectId: string; lang: string; label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="self-start text-sm font-medium underline underline-offset-4" disabled={pending}
      aria-label={`${label}: ${title}`}
      onClick={() => start(async () => {
        const result = await applicationFromSaved(foundId);
        if (result.ok) router.push(`/${lang}/projects/${projectId}/apply/${result.id}`);
      })}>
      {label}
    </button>
  );
}
