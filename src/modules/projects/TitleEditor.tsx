"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameProject } from "./actions";

type Copy = { rename: string; renameLabel: string; renameSave: string; renameCancel: string; renameFailed: string; titleSuggested: string };

/** The project title, with an inline rename. A title the person chooses is never changed by Gusty. */
export function TitleEditor({
  projectId,
  title,
  suggested,
  copy,
}: {
  projectId: string;
  title: string;
  suggested: boolean;
  copy: Copy;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          startTransition(async () => {
            const result = await renameProject(projectId, value);
            setFailed(!result.ok);
            if (result.ok) {
              setEditing(false);
              router.refresh();
            }
          });
        }}
      >
        <input
          aria-label={copy.renameLabel}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={120}
          autoFocus
          className="h-12 flex-1 rounded-xl border border-stone bg-paper px-3 text-xl font-semibold"
        />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary min-h-11 px-4" disabled={pending || !value.trim()}>
            {copy.renameSave}
          </button>
          <button type="button" className="text-sm font-medium underline underline-offset-4"
            onClick={() => { setEditing(false); setValue(title); }}>
            {copy.renameCancel}
          </button>
        </div>
        {failed && <p role="alert" className="text-sm font-medium sm:basis-full">{copy.renameFailed}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        <button type="button" className="text-sm font-medium underline underline-offset-4"
          onClick={() => setEditing(true)} aria-label={`${copy.rename}: ${title}`}>
          {copy.rename}
        </button>
      </div>
      {suggested && (
        <p className="text-xs font-medium">
          <span className="rounded-full bg-lilac px-2 py-0.5 text-ink">{copy.titleSuggested}</span>
        </p>
      )}
    </div>
  );
}
