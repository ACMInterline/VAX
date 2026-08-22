import Link from "next/link";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";

export function PublicNotFoundPage({ locale }: { locale: PublicLocale }) {
  const copy = getPublicContent(locale).pages.notFound;

  return (
    <section className="not-found-page">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        <div className="page-hero__actions">
          <Link
            className="button-link button-link--primary"
            href={localizePublicPath(locale, "/")}
          >
            <span>{copy.homeAction}</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            className="button-link button-link--quiet"
            href={localizePublicPath(locale, "/services")}
          >
            <span>{copy.servicesAction}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
