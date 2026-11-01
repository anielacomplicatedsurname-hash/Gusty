import Link from "next/link";
import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { listProjects } from "./data";
import { getProjectOverview, type NextThing } from "./overview";

/** The next thing in words, for cards: the step's title, or what to do. */
export const nextText = (next: NextThing, t: Messages) =>
  next.kind === "step" ? next.step.title : t.projectHome.next[next.kind].title;

/** For people coming back: their most recent project and its next step, as one wide panel with one main
 * button. Nothing for first-time visitors. Marked data-returning so the start area folds the idea box away. */
export async function WelcomeBack({ lang, t }: { lang: string; t: Messages }) {
  const [latest] = await listProjects();
  if (!latest) return null;
  const overview = await getProjectOverview(latest.id);
  if (!overview) return null;
  const w = t.projectHome.welcome;
  return (
    <section aria-labelledby="welcome-title" data-returning=""
      className="flex flex-col gap-5 rounded-(--radius-card) border border-border bg-surface-raised p-6 shadow-[0_1px_0_rgba(17,17,17,0.04)] sm:p-8 md:flex-row md:items-center md:justify-between md:gap-10">
      <div className="min-w-0">
        <h2 id="welcome-title" className="type-heading">{w.title}</h2>
        <p className="mt-2 text-lg font-semibold">{latest.title}</p>
        <p className="text-text-muted">{fill(w.next, { step: nextText(overview.next, t) })}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-5">
        <Link href={`/${lang}/projects/${latest.id}`} className="btn-primary">
          {w.continue} <span aria-hidden="true">→</span>
        </Link>
        <Link href={`/${lang}/projects`} className="font-medium underline underline-offset-4">{w.all}</Link>
      </div>
    </section>
  );
}
