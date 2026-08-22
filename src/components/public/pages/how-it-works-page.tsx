import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FabricVisual } from "../fabric-visual";
import { PageHero } from "../page-hero";
import { ProcessSteps } from "../process-steps";
import { SectionHeading } from "../section-heading";
import { TreatmentLevels } from "../treatment-levels";

export function HowItWorksPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.howItWorks;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/how-it-works" },
        ]}
        aside={<FabricVisual locale={locale} variant="care" />}
      >
        <ButtonLink href={localizePublicPath(locale, "/request")}>
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading {...copy.stepsIntro} />
          <ProcessSteps steps={copy.steps} />
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container assessment-band">
          <div>
            <span className="assessment-band__number">
              {copy.treatmentBand.range}
            </span>
            <p>{copy.treatmentBand.note}</p>
          </div>
          <div>
            <h2>{copy.treatmentBand.title}</h2>
            <p>{copy.treatmentBand.text}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <TreatmentLevels levels={content.treatmentLevels} locale={locale} />
        </div>
      </section>

      <section className="section section--deep">
        <div className="site-container return-guidance">
          <div>
            <p className="eyebrow eyebrow--light">{copy.reuse.eyebrow}</p>
            <h2>{copy.reuse.title}</h2>
          </div>
          <div>
            <p>{copy.reuse.description}</p>
            <p className="fine-print fine-print--light">{copy.reuse.note}</p>
          </div>
        </div>
      </section>

      <CallToAction locale={locale} />
    </>
  );
}
