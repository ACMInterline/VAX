import Link from "next/link";
import type { ServiceContent } from "@/content/public-site/types";

export function ServiceCard({ service, index }: { service: ServiceContent; index: number }) {
  return (
    <article className="service-card">
      <div className="service-card__top">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span>On-site care</span>
      </div>
      <div>
        <p className="service-card__eyebrow">{service.eyebrow}</p>
        <h3>{service.shortTitle}</h3>
        <p>{service.description}</p>
      </div>
      <Link href={`/services/${service.slug}`}>
        Explore service
        <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}
