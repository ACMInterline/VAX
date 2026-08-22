import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FabricVisual, PhotoPlaceholder } from "../fabric-visual";
import { PageHero } from "../page-hero";
import { SectionHeading } from "../section-heading";

export function AboutPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.about;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/about" },
        ]}
        aside={<FabricVisual locale={locale} variant="care" />}
      >
        <ButtonLink
          href={localizePublicPath(locale, "/why-professional-cleaning")}
        >
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container about-statement">
          <p className="eyebrow">{copy.statement.eyebrow}</p>
          <h2>{copy.statement.title}</h2>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container">
          <SectionHeading {...copy.principlesIntro} />
          <div className="principle-grid principle-grid--four">
            {copy.principles.map((principle, index) => (
              <article key={principle.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{principle.title}</h2>
                <p>{principle.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container split-feature split-feature--reverse">
          <div className="split-feature__copy">
            <p className="eyebrow">{copy.proof.eyebrow}</p>
            <h2>{copy.proof.title}</h2>
            <p>{copy.proof.text}</p>
            <p className="fine-print">{copy.proof.note}</p>
          </div>
          <PhotoPlaceholder
            locale={locale}
            title={copy.proof.photoTitle}
            note={copy.proof.photoNote}
          />
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
