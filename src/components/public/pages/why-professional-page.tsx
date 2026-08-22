import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FabricVisual, PhotoPlaceholder } from "../fabric-visual";
import { PageHero } from "../page-hero";
import { SectionHeading } from "../section-heading";

export function WhyProfessionalPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.whyProfessional;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/why-professional-cleaning" },
        ]}
        aside={<FabricVisual locale={locale} variant="care" />}
      >
        <ButtonLink href={localizePublicPath(locale, "/services")}>
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.pillarsIntro} />
          <div className="principle-grid">
            {copy.pillars.map((pillar, index) => (
              <article key={pillar.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{pillar.title}</h2>
                <p>{pillar.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container split-feature">
          <PhotoPlaceholder
            locale={locale}
            title={copy.preservation.photoTitle}
            note={copy.preservation.photoNote}
          />
          <div className="split-feature__copy">
            <p className="eyebrow">{copy.preservation.eyebrow}</p>
            <h2>{copy.preservation.title}</h2>
            <p>{copy.preservation.text}</p>
            <ul className="care-point-list">
              {copy.preservation.points.map((point, index) => (
                <li key={point}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section section--hygiene">
        <div className="site-container professional-boundary">
          <div>
            <p className="eyebrow">{copy.hygiene.eyebrow}</p>
            <h2>{copy.hygiene.title}</h2>
          </div>
          <div>
            <p>{copy.hygiene.text}</p>
            <p className="fine-print">{copy.hygiene.note}</p>
          </div>
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
