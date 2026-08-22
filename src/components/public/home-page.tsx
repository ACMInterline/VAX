import Link from "next/link";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "./button-link";
import { CallToAction } from "./call-to-action";
import { FabricVisual, PhotoPlaceholder } from "./fabric-visual";
import { FaqList } from "./faq-list";
import { ProcessSteps } from "./process-steps";
import { SectionHeading } from "./section-heading";
import { ServiceCard } from "./service-card";
import { TreatmentLevels } from "./treatment-levels";
import { TrustStrip } from "./trust-strip";

export function HomePage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.home;

  return (
    <>
      <section className="home-hero">
        <div className="site-container home-hero__grid">
          <div className="home-hero__copy">
            <p className="hero-kicker">
              <span aria-hidden="true" />
              {copy.hero.kicker}
            </p>
            <h1>{copy.hero.title}</h1>
            <p className="home-hero__summary">{copy.hero.description}</p>
            <div className="home-hero__actions">
              <ButtonLink href={localizePublicPath(locale, "/request")}>
                {copy.hero.primaryAction}
              </ButtonLink>
              <ButtonLink
                href={localizePublicPath(locale, "/services")}
                variant="quiet"
              >
                {copy.hero.secondaryAction}
              </ButtonLink>
            </div>
            <dl className="hero-facts">
              {copy.hero.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="home-hero__visual">
            <FabricVisual locale={locale} />
            <div className="capacity-card">
              <span className="capacity-card__value">
                {copy.hero.capacityValue}
              </span>
              <span>{copy.hero.capacityLabel}</span>
              <p>{copy.hero.capacityNote}</p>
            </div>
          </div>
        </div>
      </section>

      <TrustStrip locale={locale} />

      <section className="section section--services" id="services-overview">
        <div className="site-container">
          <SectionHeading
            {...copy.services}
            action={
              <ButtonLink
                href={localizePublicPath(locale, "/services")}
                variant="quiet"
              >
                {copy.services.action}
              </ButtonLink>
            }
          />
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

      <section className="section section--deep">
        <div className="site-container on-site-grid">
          <div className="on-site-copy">
            <p className="eyebrow eyebrow--light">{copy.onSite.eyebrow}</p>
            <h2>{copy.onSite.title}</h2>
            <p>{copy.onSite.description}</p>
            <div className="on-site-points">
              {copy.onSite.points.map((point, index) => (
                <div key={point}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>
            <p className="fine-print fine-print--light">{copy.onSite.note}</p>
          </div>
          <PhotoPlaceholder
            locale={locale}
            title={copy.onSite.photoTitle}
            note={copy.onSite.photoNote}
          />
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container reuse-grid">
          <div className="reuse-grid__lead">
            <p className="eyebrow">{copy.reuse.eyebrow}</p>
            <h2>{copy.reuse.title}</h2>
            <p>{copy.reuse.description}</p>
            <ButtonLink
              href={localizePublicPath(locale, "/how-it-works")}
              variant="quiet"
            >
              {copy.reuse.action}
            </ButtonLink>
          </div>
          <div
            className="reuse-factors"
            aria-label={copy.reuse.eyebrow}
          >
            {copy.reuse.factors.map((factor, index) => (
              <div key={factor}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{factor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.treatments} />
          <TreatmentLevels levels={content.treatmentLevels} locale={locale} />
        </div>
      </section>

      <section className="section section--bordered">
        <div className="site-container care-balance-grid">
          <div className="care-balance-grid__statement">
            <p className="eyebrow">{copy.preservation.eyebrow}</p>
            <h2>
              {copy.preservation.formulaLead}
              <span>{copy.preservation.formulaJoin}</span>
              {copy.preservation.formulaEnd}
            </h2>
          </div>
          <div className="care-balance-grid__details">
            <p>{copy.preservation.description}</p>
            <ul className="check-list check-list--columns">
              {copy.preservation.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="fine-print">{copy.preservation.note}</p>
          </div>
        </div>
      </section>

      <section className="section section--hygiene">
        <div className="site-container hygiene-grid">
          <div>
            <p className="eyebrow">{copy.hygiene.eyebrow}</p>
            <h2>{copy.hygiene.title}</h2>
          </div>
          <blockquote>“{copy.hygiene.quote}”</blockquote>
          <div className="hygiene-note">
            <span>{copy.hygiene.boundaryLabel}</span>
            <p>{copy.hygiene.note}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow={copy.audiences.eyebrow}
            title={copy.audiences.title}
            description={copy.audiences.description}
          />
          <div className="audience-grid">
            {[copy.audiences.residential, copy.audiences.business].map(
              (audience, index) => (
                <article
                  key={audience.label}
                  className={index === 1 ? "audience-grid__business" : undefined}
                >
                  <span>{audience.label}</span>
                  <h3>{audience.title}</h3>
                  <p>{audience.text}</p>
                  <ul>
                    {audience.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="section section--process">
        <div className="site-container">
          <SectionHeading
            eyebrow={copy.process.eyebrow}
            title={copy.process.title}
          />
          <ProcessSteps steps={copy.process.steps} />
        </div>
      </section>

      <section className="section section--area">
        <div className="site-container area-callout">
          <div className="area-callout__map" aria-hidden="true">
            <span>SOF</span>
            <i />
            <b />
          </div>
          <div>
            <p className="eyebrow">{copy.area.eyebrow}</p>
            <h2>{copy.area.title}</h2>
            <p>{copy.area.description}</p>
            <div className="area-callout__actions">
              <ButtonLink href={localizePublicPath(locale, "/service-area")}>
                {copy.area.action}
              </ButtonLink>
              <span>{content.common.brand.appointmentShort}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container faq-home-grid">
          <div>
            <p className="eyebrow">{copy.faq.eyebrow}</p>
            <h2>{copy.faq.title}</h2>
            <p>{copy.faq.description}</p>
            <Link
              href={localizePublicPath(locale, "/faq")}
              className="text-link"
            >
              {copy.faq.action} <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <FaqList faqs={content.faqs} limit={5} />
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
