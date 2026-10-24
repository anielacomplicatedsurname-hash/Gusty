import { ComingNext, comingNextMetadata } from "@/components/ComingNext";

export const generateMetadata = () => comingNextMetadata("explore");

export default async function ExplorePage({ params }: PageProps<"/[lang]/explore">) {
  const { lang } = await params;
  return <ComingNext section="explore" symbol="horizon-hill" locale={lang} />;
}
