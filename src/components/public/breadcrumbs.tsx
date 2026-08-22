import Link from "next/link";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { buildBreadcrumbJsonLd } from "@/lib/public-metadata";
import { StructuredData } from "./structured-data";

type Breadcrumb = {
  label: string;
  href?: string;
  path?: string;
};

export function Breadcrumbs({
  items,
  locale,
}: {
  items: readonly Breadcrumb[];
  locale: PublicLocale;
}) {
  const navigationLabel =
    getPublicContent(locale).common.accessibility.breadcrumb;
  const structuredItems = items.map((item) => ({
    name: item.label,
    path: localizePublicPath(locale, item.path ?? item.href ?? "/"),
  }));

  return (
    <>
      <nav className="breadcrumbs" aria-label={navigationLabel}>
        <ol>
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.href ? (
                <Link href={localizePublicPath(locale, item.href)}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
              {index < items.length - 1 ? (
                <span className="breadcrumbs__divider" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
      <StructuredData data={buildBreadcrumbJsonLd(structuredItems)} />
    </>
  );
}
