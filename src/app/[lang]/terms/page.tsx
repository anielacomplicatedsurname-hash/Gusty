import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getMessages } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.legal.terms.title, description: t.legal.terms.description };
}

export default async function TermsPage() {
  const t = await getMessages();
  return <LegalPage copy={t.legal.terms} />;
}
