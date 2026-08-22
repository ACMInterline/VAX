import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicLanguageConfig } from "@/config/public-site";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicContent } from "@/content/public-site";
import { createRootMetadata } from "@/lib/public-metadata";
import "../globals.css";

const locale = "bg";
const homeMetadata = getPublicContent(locale).metadata.home;

export const metadata: Metadata = createRootMetadata({
  locale,
  title: homeMetadata.title,
  description: homeMetadata.description,
});

export default function BulgarianPublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang={publicLanguageConfig.htmlLanguages[locale]}
      data-scroll-behavior="smooth"
    >
      <body>
        <PublicShell locale={locale}>{children}</PublicShell>
      </body>
    </html>
  );
}
