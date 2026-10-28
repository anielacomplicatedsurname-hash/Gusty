import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getMessages } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.legal.privacy.title, description: t.legal.privacy.description };
}

export default async function PrivacyPage() {
  const t = await getMessages();
  return <LegalPage copy={t.legal.privacy} />;
}
