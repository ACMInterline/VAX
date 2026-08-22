import type { ReactNode } from "react";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { StructuredData } from "@/components/public/structured-data";
import { buildBusinessJsonLd } from "@/lib/public-metadata";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
      <StructuredData data={buildBusinessJsonLd()} />
    </>
  );
}
