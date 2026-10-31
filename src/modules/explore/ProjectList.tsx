import Link from "next/link";
import type { Messages } from "@/i18n/dictionaries";
import { fill, formatDate } from "@/i18n/format";
import type { ProjectSummary } from "@/modules/projects/data";
import { freshness, type Freshness } from "./data";

const DOT: Record<Freshness, string> = {
  fresh: "bg-(--status-fresh)",
  aging: "bg-(--status-aging)",
  old: "bg-(--status-old)",
  never: "border-2 border-stone bg-transparent",
};

/** The person's projects with a light for how recent each one's deep search is. Word and colour together. */
export function ProjectList({ projects, last, chosenId, lang, copy, headingLevel = "h2" }: {
  projects: ProjectSummary[]; last: Map<string, string>; chosenId: string | null; lang: string;
  copy: Messages["explore"]; headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <nav aria-labelledby="projects-side-title" className="flex flex-col gap-3">
      <Heading id="projects-side-title" className="text-lg font-semibold">{chosenId ? copy.sideTitle : copy.chooseTitle}</Heading>
      <ul className="flex flex-col gap-2">
        {projects.map((p) => {
          const when = last.get(p.id) ?? null;
          const state = freshness(when);
          const current = p.id === chosenId;
          return (
            <li key={p.id}>
              <Link href={`/${lang}/explore?project=${p.id}`} aria-current={current ? "page" : undefined}
                className={`flex min-h-12 flex-col justify-center rounded-xl border px-4 py-2 ${current ? "border-ink bg-oat" : "border-border hover:bg-oat/60"}`}>
                <span className="font-medium">{p.title}</span>
                <span className="flex items-center gap-2 text-sm text-text-muted">
                  <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${DOT[state]}`} />
                  {copy.fresh[state]}
                  {when && <span className="sr-only">. {fill(copy.lastSearched, { date: formatDate(when, lang) })}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-text-muted">{copy.freshHint}</p>
    </nav>
  );
}
