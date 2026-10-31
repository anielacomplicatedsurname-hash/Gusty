/** Turns the data export into a plain document anyone can read: headings, the person's words, no code. */

type Labels = {
  heading: string; exported: string; idea: string; understood: string; plan: string; done: string; open: string;
  notes: string; answers: string; experience: string; research: string; voice: string; applications: string;
  question: string; noAnswer: string; documents: string; foundBy: string;
};

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);

export function readableExport(body: { exportedAt: string; projects: Row[] }, l: Labels, factLabels: Record<string, string>): string {
  const out: string[] = [l.heading, l.exported.replace("{date}", body.exportedAt.slice(0, 10)), ""];
  const section = (title: string) => out.push("", title, "-".repeat(title.length));

  for (const p of body.projects) {
    const title = str(p.title) || "Project";
    out.push("", "=".repeat(Math.min(60, title.length + 4)), title, "=".repeat(Math.min(60, title.length + 4)));
    section(l.idea);
    out.push(str(p.idea));

    const facts = list(p.reading).filter((f) => factLabels[str(f.kind)]);
    if (facts.length) {
      section(l.understood);
      for (const f of facts) out.push(`- ${factLabels[str(f.kind)]}: ${str(f.value)}`);
    }

    const steps = list(p.steps);
    if (steps.length) {
      section(l.plan);
      for (const s of steps) {
        out.push(`${str(s.status) === "done" ? "[x]" : "[ ]"} ${str(s.title)}`);
        for (const a of list(s.answers)) if (str(a.answer)) out.push(`    ${str(a.question)}`, `    ${str(a.answer)}`);
        if (str(s.notes)) out.push(`    ${l.notes}: ${str(s.notes)}`);
      }
    }

    const experience = list(p.experience);
    if (experience.length) {
      section(l.experience);
      for (const e of experience) out.push(`- ${str(e.text)}${str(e.url) ? ` (${str(e.url)})` : ""}`);
    }
    const research = list(p.research);
    if (research.length) {
      section(l.research);
      for (const r of research) {
        out.push(`- ${str(r.title)}${str(r.publisher) ? `, ${str(r.publisher)}` : ""}${str(r.year) ? ` (${str(r.year)})` : ""}`);
        out.push(`  ${str(r.text)}`, `  ${str(r.url)}`, `  ${l.foundBy.replace("{date}", str(r.found_at).slice(0, 10))}`);
      }
    }
    const voice = p.voice as Row | null;
    if (voice && str(voice.description)) {
      section(l.voice);
      out.push(str(voice.description));
    }
    const docs = list(p.documents);
    if (docs.length) {
      section(l.documents);
      for (const d of docs) out.push(`- ${str(d.filename)}: ${str(d.summary)}`);
    }
    const apps = list(p.applications);
    if (apps.length) {
      section(l.applications);
      for (const a of apps) {
        out.push("", `${str(a.title)}${str(a.funder) ? ` (${str(a.funder)})` : ""}`);
        list(a.answers).forEach((x, i) => {
          out.push(`  ${l.question} ${i + 1}: ${str(x.question)}`, `  ${str(x.answer) || l.noAnswer}`, "");
        });
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}
