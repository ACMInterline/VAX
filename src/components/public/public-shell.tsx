import type { ReactNode } from "react";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { buildBusinessJsonLd } from "@/lib/public-metadata";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StructuredData } from "./structured-data";

export function PublicShell({
  children,
  locale,
}: {
  children: ReactNode;
  locale: PublicLocale;
}) {
  const copy = getPublicContent(locale).common;

  return (
    <>
      <a className="skip-link" href="#main-content">
        {copy.accessibility.skipToContent}
      </a>
      <SiteHeader locale={locale} />
      <main id="main-content">{children}</main>
      <SiteFooter locale={locale} />
      <StructuredData data={buildBusinessJsonLd()} />
    </>
  );
}
