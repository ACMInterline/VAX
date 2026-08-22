import type { PublicLocale } from "@/config/public-site";
import { getPublicContent, getService } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import type { ServiceContent } from "@/content/public-site/types";
import { ButtonLink } from "./button-link";
import { CallToAction } from "./call-to-action";
import { FabricVisual, PhotoPlaceholder } from "./fabric-visual";
import { PageHero } from "./page-hero";
import { SectionHeading } from "./section-heading";
import { ServiceCard } from "./service-card";

export function ServiceDetailPage({
  service,
  locale,
}: {
  service: ServiceContent;
  locale: PublicLocale;
}) {
  const content = getPublicContent(locale);
  const copy = content.common.serviceDetail;
  const relatedServices = service.related
    .map((slug) => getService(locale, slug))
    .filter((item): item is ServiceContent => item !== undefined);

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={service.eyebrow}
        title={service.title}
        description={service.description}
        breadcrumbs={[
          { label: copy.home, href: "/" },
          { label: copy.services, href: "/services" },
          { label: service.shortTitle, path: `/services/${service.slug}` },
        ]}
        aside={
          <FabricVisual
            locale={locale}
            variant="care"
            label={`${copy.visualLabel}: ${service.shortTitle}`}
          />
        }
      >
        <ButtonLink href={localizePublicPath(locale, "/request")}>
          {copy.describeSurface}
        </ButtonLink>
        <ButtonLink
          href={localizePublicPath(locale, "/how-it-works")}
          variant="quiet"
        >
          {copy.seeProcess}
        </ButtonLink>
      </PageHero>

      <section className="section section--bordered">
        <div className="site-container service-intro-grid">
          <div>
            <p className="eyebrow">{copy.serviceEyebrow}</p>
            <h2>{service.summary}</h2>
          </div>
          <div className="ideal-for-card">
            <p>{copy.idealFor}</p>
            <ul className="check-list">
              {service.idealFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.process} />
          <ol className="service-process">
            {service.process.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container split-feature">
          <PhotoPlaceholder
            locale={locale}
            title={`${service.shortTitle} · Sofia`}
            note={copy.futureImage}
          />
          <div className="split-feature__copy">
            <p className="eyebrow">{copy.materialEyebrow}</p>
            <h2>{copy.materialTitle}</h2>
            <p>{copy.materialDescription}</p>
            <ul className="care-point-list">
              {service.carePoints.map((point, index) => (
                <li key={point}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container expectations-grid">
          <div className="expectation-panel expectation-panel--positive">
            <p className="eyebrow">{copy.expectationsEyebrow}</p>
            <h2>{copy.expectationsTitle}</h2>
            <ul>
              {service.expectations.map((expectation) => (
                <li key={expectation}>{expectation}</li>
              ))}
            </ul>
          </div>
          <div className="expectation-panel expectation-panel--caution">
            <p className="eyebrow">{copy.limitationsEyebrow}</p>
            <h2>{copy.limitationsTitle}</h2>
            <ul>
              {service.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section section--bordered related-services">
        <div className="site-container">
          <SectionHeading {...copy.related} />
          <div className="service-grid service-grid--two">
            {relatedServices.map((related, index) => (
              <ServiceCard
                key={related.slug}
                service={related}
                index={index}
                locale={locale}
              />
            ))}
          </div>
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
