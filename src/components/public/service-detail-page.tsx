import type { ServiceContent } from "@/content/public-site/types";
import { getService } from "@/content/public-site";
import { ButtonLink } from "./button-link";
import { CallToAction } from "./call-to-action";
import { FabricVisual, PhotoPlaceholder } from "./fabric-visual";
import { PageHero } from "./page-hero";
import { SectionHeading } from "./section-heading";
import { ServiceCard } from "./service-card";

export function ServiceDetailPage({ service }: { service: ServiceContent }) {
  const relatedServices = service.related
    .map((slug) => getService(slug))
    .filter((item): item is ServiceContent => item !== undefined);

  return (
    <>
      <PageHero
        eyebrow={service.eyebrow}
        title={service.title}
        description={service.description}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Services", href: "/services" },
          { label: service.shortTitle, path: `/services/${service.slug}` },
        ]}
        aside={<FabricVisual variant="care" label={`Abstract fabric-care visual for ${service.shortTitle}`} />}
      >
        <ButtonLink href="/request">Describe your surface</ButtonLink>
        <ButtonLink href="/how-it-works" variant="quiet">
          See the process
        </ButtonLink>
      </PageHero>

      <section className="section section--bordered">
        <div className="site-container service-intro-grid">
          <div>
            <p className="eyebrow">The service</p>
            <h2>{service.summary}</h2>
          </div>
          <div className="ideal-for-card">
            <p>Well suited to</p>
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
          <SectionHeading
            eyebrow="A controlled sequence"
            title="Assessment directs the work."
            description="You provide useful context before the visit. The final method and intensity remain professional decisions made after seeing the item."
          />
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
            title={`${service.shortTitle} in a real Sofia setting`}
            note="Future image: actual technician, equipment and material detail, used with permission."
          />
          <div className="split-feature__copy">
            <p className="eyebrow">Material before muscle</p>
            <h2>Care decisions that respect the surface.</h2>
            <p>
              Cleaning effectiveness matters, but so do fibre sensitivity,
              colour response, age, construction and existing wear.
            </p>
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
            <p className="eyebrow">What to expect</p>
            <h2>Clear, practical guidance.</h2>
            <ul>
              {service.expectations.map((expectation) => (
                <li key={expectation}>{expectation}</li>
              ))}
            </ul>
          </div>
          <div className="expectation-panel expectation-panel--caution">
            <p className="eyebrow">Important limits</p>
            <h2>No one-size-fits-all promises.</h2>
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
          <SectionHeading
            eyebrow="Related care"
            title="Other surfaces in the same space."
          />
          <div className="service-grid service-grid--two">
            {relatedServices.map((related, index) => (
              <ServiceCard key={related.slug} service={related} index={index} />
            ))}
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
