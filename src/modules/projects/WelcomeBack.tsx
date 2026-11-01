import Link from "next/link";
import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { listProjects } from "./data";
import { getProjectOverview, type NextThing } from "./overview";

/** The next thing in words, for cards: the step's title, or what to do. */
export const nextText = (next: NextThing, t: Messages) =>
  next.kind === "step" ? next.step.title : t.projectHome.next[next.kind].title;

/** For people coming back: their most recent project and its next step. Nothing for first-time visitors. */
export async function WelcomeBack({ lang, t }: { lang: string; t: Messages }) {
  const [latest] = await listProjects();
  if (!latest) return null;
  const overview = await getProjectOverview(latest.id);
  if (!overview) return null;
  const w = t.projectHome.welcome;
  // The top of the home page's idea card: same width, a quiet paper tint, a line before the idea box.
  return (
    <section aria-labelledby="welcome-title" className="flex flex-col items-start gap-1 border-b border-border bg-surface p-5 sm:p-6">
      <p className="type-label text-text-muted">{w.label}</p>
      <h2 id="welcome-title" className="type-heading">{w.title}</h2>
      <p className="mt-2 font-semibold">{latest.title}</p>
      <p className="text-text-muted">{fill(w.next, { step: nextText(overview.next, t) })}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Link href={`/${lang}/projects/${latest.id}`} className="btn-primary">{w.continue}</Link>
        <Link href={`/${lang}/projects`} className="font-medium underline underline-offset-4">{w.all}</Link>
      </div>
    </section>
  );
}
