import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FabricVisual } from "../fabric-visual";
import { PageHero } from "../page-hero";
import { SectionHeading } from "../section-heading";
import { ServiceCard } from "../service-card";
import { TreatmentLevels } from "../treatment-levels";

export function ServicesPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.services;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/services" },
        ]}
        aside={<FabricVisual locale={locale} variant="care" />}
      >
        <ButtonLink href={localizePublicPath(locale, "/request")}>
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.catalogue} />
          <div className="service-grid">
            {content.services.map((service, index) => (
              <ServiceCard
                key={service.slug}
                service={service}
                index={index}
                locale={locale}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container capacity-feature">
          <div>
            <p className="eyebrow">{copy.capacity.eyebrow}</p>
            <strong>{copy.capacity.title}</strong>
          </div>
          <p>{copy.capacity.text}</p>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.treatments} />
          <TreatmentLevels levels={content.treatmentLevels} locale={locale} />
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
