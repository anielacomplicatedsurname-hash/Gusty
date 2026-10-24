import { ComingNext, comingNextMetadata } from "@/components/ComingNext";

export const generateMetadata = () => comingNextMetadata("projects");

export default async function ProjectsPage({ params }: PageProps<"/[lang]/projects">) {
  const { lang } = await params;
  return <ComingNext section="projects" symbol="sprout" locale={lang} />;
}
