import { publicBrand, type PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FabricVisual } from "../fabric-visual";
import { PageHero } from "../page-hero";
import { SectionHeading } from "../section-heading";

export function ServiceAreaPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.serviceArea;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/service-area" },
        ]}
        aside={
          <FabricVisual
            locale={locale}
            variant="business"
            label={copy.hero.visualLabel}
          />
        }
      >
        <ButtonLink href={localizePublicPath(locale, "/request")}>
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container coverage-grid">
          {copy.coverage.map((item) => (
            <article
              key={item.title}
              className={`coverage-card${
                item.tone === "primary"
                  ? " coverage-card--primary"
                  : item.tone === "deferred"
                    ? " coverage-card--deferred"
                    : ""
              }`}
            >
              <span>{item.label}</span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container schedule-grid">
          <div>
            <p className="eyebrow">{copy.schedule.eyebrow}</p>
            <h2>{copy.schedule.title}</h2>
          </div>
          <div className="schedule-card">
            <span className="schedule-card__time">
              {publicBrand.intendedAppointmentWindow.start}—
              {publicBrand.intendedAppointmentWindow.end}
            </span>
            <p>{content.common.brand.appointmentDetail}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.placesIntro} />
          <div className="place-grid">
            {copy.places.map((place, index) => (
              <div key={place}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{place}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CallToAction locale={locale} {...copy.cta} />
    </>
  );
}
