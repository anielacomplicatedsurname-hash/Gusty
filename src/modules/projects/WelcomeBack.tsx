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
  return (
    <section aria-labelledby="welcome-title" className="mb-8 flex flex-col items-start gap-2 rounded-(--radius-card) border-2 border-ink bg-surface-raised p-5">
      <p className="type-label text-text-muted">{w.label}</p>
      <h2 id="welcome-title" className="type-display text-3xl">{w.title}</h2>
      <p className="mt-1 font-semibold">{latest.title}</p>
      <p className="text-text-muted">{fill(w.next, { step: nextText(overview.next, t) })}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Link href={`/${lang}/projects/${latest.id}`} className="btn-primary">{w.continue}</Link>
        <Link href={`/${lang}/projects`} className="font-medium underline underline-offset-4">{w.all}</Link>
      </div>
    </section>
  );
}
