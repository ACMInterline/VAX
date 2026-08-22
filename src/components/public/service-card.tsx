import Link from "next/link";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import type { ServiceContent } from "@/content/public-site/types";

export function ServiceCard({
  service,
  index,
  locale,
}: {
  service: ServiceContent;
  index: number;
  locale: PublicLocale;
}) {
  const copy = getPublicContent(locale).common.serviceCard;

  return (
    <article className="service-card">
      <div className="service-card__top">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span>{copy.onSite}</span>
      </div>
      <div>
        <p className="service-card__eyebrow">{service.eyebrow}</p>
        <h3>{service.shortTitle}</h3>
        <p>{service.description}</p>
      </div>
      <Link
        href={localizePublicPath(locale, `/services/${service.slug}`)}
      >
        {copy.explore}
        <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}
