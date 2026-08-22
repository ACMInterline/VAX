import type { ReactNode } from "react";
import type { PublicLocale } from "@/config/public-site";
import { Breadcrumbs } from "./breadcrumbs";

type PageHeroProps = {
  locale: PublicLocale;
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbs?: readonly { label: string; href?: string; path?: string }[];
  aside?: ReactNode;
  children?: ReactNode;
};

export function PageHero({
  locale,
  eyebrow,
  title,
  description,
  breadcrumbs,
  aside,
  children,
}: PageHeroProps) {
  return (
    <section className="page-hero">
      <div className="site-container">
        {breadcrumbs ? (
          <Breadcrumbs items={breadcrumbs} locale={locale} />
        ) : null}
        <div className="page-hero__grid">
          <div className="page-hero__copy">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="page-hero__description">{description}</p>
            {children ? (
              <div className="page-hero__actions">{children}</div>
            ) : null}
          </div>
          {aside ? <div className="page-hero__aside">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}
