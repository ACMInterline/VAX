import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FabricVisual, PhotoPlaceholder } from "@/components/public/fabric-visual";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const pageMetadata = getPublicContent().metadata.whyProfessional;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/why-professional-cleaning",
});

const pillars = [
  {
    number: "01",
    title: "Read the material",
    text: "Fibre, dyes, backing, seams, fillings and existing wear change what a safe result looks like.",
  },
  {
    number: "02",
    title: "Control the method",
    text: "Chemistry, agitation, moisture, dwell time and extraction should be proportionate rather than automatic.",
  },
  {
    number: "03",
    title: "Explain the outcome",
    text: "A useful handover separates removable soil from permanent wear, colour change or stains that should not be chased aggressively.",
  },
] as const;

export default function WhyProfessionalCleaningPage() {
  return (
    <>
      <PageHero
        eyebrow="Professional judgement"
        title="Good cleaning is not simply more force."
        description="The professional difference is the ability to assess a surface, choose proportionate treatment and stop short of unnecessary material stress."
        breadcrumbs={[
          { label: "Home", href: "/" },
          {
            label: "Why professional care",
            path: "/why-professional-cleaning",
          },
        ]}
        aside={<FabricVisual variant="care" />}
      >
        <ButtonLink href="/services">Explore surfaces</ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Three differences"
            title="Assessment. Control. Explanation."
          />
          <div className="principle-grid">
            {pillars.map((pillar) => (
              <article key={pillar.number}>
                <span>{pillar.number}</span>
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
            title="Close material assessment"
            note="Future image: real fibre, seam and colour-response inspection, without fabricated results."
          />
          <div className="split-feature__copy">
            <p className="eyebrow">Preservation is part of performance</p>
            <h2>The cleanest-looking decision is not always the best decision.</h2>
            <p>
              When a mark has changed the material itself, repeated aggressive
              work can trade a small visual gain for damage. Professional care
              aims for the best reasonable result while preserving useful life.
            </p>
            <ul className="care-point-list">
              <li><span>01</span>Fibre sensitivity and colourfastness</li>
              <li><span>02</span>Existing wear, age and construction</li>
              <li><span>03</span>Brushing intensity and chemical selection</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section section--hygiene">
        <div className="site-container professional-boundary">
          <div>
            <p className="eyebrow">Responsible hygiene language</p>
            <h2>Remove what can be supported. Do not invent a health outcome.</h2>
          </div>
          <div>
            <p>
              Deep professional cleaning can help remove accumulated soil, dust
              and residues that routine vacuuming may leave behind.
            </p>
            <p className="fine-print">
              Specific antibacterial, anti-allergen or manufacturer product
              statements require evidence review before publication. This service
              does not promise a personal medical result.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
