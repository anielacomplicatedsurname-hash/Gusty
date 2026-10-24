import { ComingNext, comingNextMetadata } from "@/components/ComingNext";

export const generateMetadata = () => comingNextMetadata("connections");

export default async function ConnectionsPage({ params }: PageProps<"/[lang]/connections">) {
  const { lang } = await params;
  return <ComingNext section="connections" symbol="gathering" locale={lang} />;
}
