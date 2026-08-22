import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/public-metadata";
import { StructuredData } from "./structured-data";

type Breadcrumb = {
  label: string;
  href?: string;
  path?: string;
};

export function Breadcrumbs({ items }: { items: readonly Breadcrumb[] }) {
  const structuredItems = items.map((item) => ({
    name: item.label,
    path: item.path ?? item.href ?? "/",
  }));

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
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
