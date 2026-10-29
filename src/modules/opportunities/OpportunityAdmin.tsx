"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { REGIONS } from "@/ai/tasks/opportunity";
import type en from "@/i18n/messages/en.json";
import { extractOpportunity, saveOpportunity, setOpportunityStatus, type Draft, type SaveState } from "./actions";
import type { Opportunity } from "./data";

type Copy = typeof en.admin.opportunities;
type RegionCopy = typeof en.explore.regions;
type Editing = { id?: string; url: string; draft: Draft; byGusty: boolean };

const empty: Draft = { title: "", funder: "", summary: "", whoFor: "", amount: "", deadline: "", deadlineNote: "", regions: [] };

/** The founder's tools: add an opportunity (Gusty can fill it in from the page), check it, publish it. */
export function OpportunityAdmin({ items, copy, regions }: { items: Opportunity[]; copy: Copy; regions: RegionCopy }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const read = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await extractOpportunity(url);
      if (result.ok) setEditing({ url: url.trim(), draft: result.draft, byGusty: true });
      else setError(copy.errors[result.error]);
    });
  };

  const change = (id: string, status: "draft" | "published" | "archived") =>
    startTransition(async () => {
      const result = await setOpportunityStatus(id, status);
      if (result.ok) router.refresh();
      else setError(copy.errors.failed);
    });

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="add-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
        <h2 id="add-title" className="text-xl font-semibold">{copy.addTitle}</h2>
        {notice && <p role="status" className="rounded-xl bg-confirmed/60 p-3 text-ink">{notice}</p>}
        {editing ? (
          <OpportunityForm
            key={editing.id ?? editing.url}
            editing={editing}
            copy={copy}
            regions={regions}
            onDone={(state) => {
              setEditing(null);
              setUrl("");
              setNotice(state.savedAs === "published" ? copy.published : copy.savedDraft);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="opp-url" className="block font-medium">{copy.urlLabel}</label>
              <p id="opp-url-hint" className="text-sm text-text-muted">{copy.urlHint}</p>
              <input id="opp-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
                aria-describedby="opp-url-hint" placeholder="https://"
                className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={pending || !url.trim()} onClick={read}>
                {pending ? copy.reading : copy.readPage}
              </button>
              <button type="button" className="btn-secondary" disabled={pending}
                onClick={() => setEditing({ url: url.trim(), draft: empty, byGusty: false })}>
                {copy.manual}
              </button>
            </div>
            {pending && <p role="status" className="text-text-muted">{copy.reading}</p>}
          </div>
        )}
        {error && <p role="alert" className="font-medium">{error}</p>}
      </section>

      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <h2 id="list-title" className="text-xl font-semibold">{copy.listTitle}</h2>
        {items.length === 0 ? (
          <p className="text-text-muted">{copy.none}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-sm text-text-muted">
                    {copy.status[o.status]} · {copy.checkedOn.replace("{date}", o.checkedAt)}
                    {o.deadline && ` · ${copy.closesOn.replace("{date}", o.deadline)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm font-medium">
                  <button type="button" className="underline underline-offset-4" disabled={pending}
                    aria-label={`${copy.edit}: ${o.title}`}
                    onClick={() => {
                      setNotice(null);
                      setEditing({
                        id: o.id, url: o.url, byGusty: false,
                        draft: { title: o.title, funder: o.funder, summary: o.summary, whoFor: o.whoFor, amount: o.amount,
                          deadline: o.deadline ?? "", deadlineNote: o.deadlineNote, regions: o.regions },
                      });
                      document.getElementById("add-title")?.scrollIntoView();
                    }}>
                    {copy.edit}
                  </button>
                  {o.status === "published" ? (
                    <button type="button" className="underline underline-offset-4" disabled={pending}
                      aria-label={`${copy.takeDown}: ${o.title}`} onClick={() => change(o.id, "archived")}>
                      {copy.takeDown}
                    </button>
                  ) : o.status === "archived" ? (
                    <button type="button" className="underline underline-offset-4" disabled={pending}
                      aria-label={`${copy.bringBack}: ${o.title}`} onClick={() => change(o.id, "published")}>
                      {copy.bringBack}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OpportunityForm({ editing, copy, regions, onDone, onCancel }: {
  editing: Editing; copy: Copy; regions: RegionCopy; onDone: (state: SaveState) => void; onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveOpportunity, {});
  const d = editing.draft;
  const f = copy.fields;

  useEffect(() => {
    if (state.ok) onDone(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const field = (name: keyof Draft, label: string, value: string, opts: { long?: boolean; type?: string; hint?: string } = {}) => (
    <div>
      <label htmlFor={`f-${name}`} className="block font-medium">{label}</label>
      {opts.hint && <p id={`f-${name}-hint`} className="text-sm text-text-muted">{opts.hint}</p>}
      {opts.long ? (
        <textarea id={`f-${name}`} name={name} defaultValue={value} rows={3} aria-describedby={opts.hint ? `f-${name}-hint` : undefined}
          className="mt-1 w-full rounded-xl border border-stone bg-paper p-3" />
      ) : (
        <input id={`f-${name}`} name={name} type={opts.type ?? "text"} defaultValue={value}
          aria-describedby={opts.hint ? `f-${name}-hint` : undefined}
          className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3" />
      )}
    </div>
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {editing.byGusty && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.filledByGusty}</p>}
      {editing.id && <input type="hidden" name="id" value={editing.id} />}
      <div>
        <label htmlFor="f-url" className="block font-medium">{copy.urlLabel}</label>
        <input id="f-url" name="url" type="url" defaultValue={editing.url} required
          className="mt-1 h-12 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      {field("title", f.title, d.title)}
      {field("funder", f.funder, d.funder)}
      {field("summary", f.summary, d.summary, { long: true })}
      {field("whoFor", f.whoFor, d.whoFor, { long: true })}
      {field("amount", f.amount, d.amount)}
      {field("deadline", f.deadline, d.deadline, { type: "date" })}
      {field("deadlineNote", f.deadlineNote, d.deadlineNote, { hint: f.deadlineNoteHint })}
      <fieldset>
        <legend className="font-medium">{f.regions}</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {REGIONS.map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="regions" value={r} defaultChecked={d.regions.includes(r)} className="h-5 w-5 accent-ink" />
              {regions[r]}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p role="alert" className="font-medium">{copy.errors[state.error === "error" ? "failed" : state.error]}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="publish" className="btn-primary" disabled={pending}>
          {pending ? copy.saving : copy.publish}
        </button>
        <button type="submit" name="intent" value="draft" className="btn-secondary" disabled={pending}>{copy.saveDraft}</button>
        <button type="button" className="font-medium underline underline-offset-4" onClick={onCancel}>{copy.cancel}</button>
      </div>
    </form>
  );
}
