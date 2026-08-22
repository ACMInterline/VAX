import type { ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbs?: readonly { label: string; href?: string; path?: string }[];
  aside?: ReactNode;
  children?: ReactNode;
};

export function PageHero({
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
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        <div className="page-hero__grid">
          <div className="page-hero__copy">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="page-hero__description">{description}</p>
            {children ? <div className="page-hero__actions">{children}</div> : null}
          </div>
          {aside ? <div className="page-hero__aside">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}
