import type { Metadata, Viewport } from "next";
import { Google_Sans_Flex, Instrument_Serif, Permanent_Marker } from "next/font/google";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ServiceWorker } from "@/components/ServiceWorker";
import { brand } from "@/config/brand";
import { hasLocale, locales, textDirection } from "@/i18n/config";
import { getMessages } from "@/i18n/dictionaries";
import "../globals.css";

// Self-hosted at build time by next/font: no requests to Google from visitors' browsers.
const uiSans = Google_Sans_Flex({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
  // next/font has no metrics for this family yet, so use a plain system fallback.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});
const displaySerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
});
// A marker hand for the one brand line ("Big possibilities. Small steps."), used large and sparingly.
const displayHand = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getMessages();
  return {
    metadataBase: new URL(brand.siteUrl),
    title: { default: t.meta.title, template: t.meta.titleTemplate },
    description: t.meta.description,
    applicationName: brand.name,
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: t.meta.title,
      description: t.meta.description,
      locale: lang,
    },
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: brand.backgroundColor,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      dir={textDirection(lang)}
      className={`${uiSans.variable} ${displaySerif.variable} ${displayHand.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppShell locale={lang}>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
