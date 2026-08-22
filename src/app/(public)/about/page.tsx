import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FabricVisual, PhotoPlaceholder } from "@/components/public/fabric-visual";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const pageMetadata = getPublicContent().metadata.about;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/about",
});

const principles = [
  {
    title: "Look before acting",
    text: "Material, condition and context come before treatment intensity.",
  },
  {
    title: "Explain uncertainty",
    text: "Stains, drying and delicate fibres deserve clear ranges and limits, not false certainty.",
  },
  {
    title: "Respect occupied spaces",
    text: "On-site work should account for access, neighbours, operations and practical return to use.",
  },
  {
    title: "Preserve useful life",
    text: "A responsible result balances visible improvement with avoidable wear and material stress.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="A considered service philosophy"
        title="Calm expertise for the fabrics people live and work with."
        description="FabricCare Sofia is designed around professional judgement, useful explanations and the convenience of caring for suitable fabrics on site."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "About", path: "/about" },
        ]}
        aside={<FabricVisual variant="care" />}
      >
        <ButtonLink href="/why-professional-cleaning">
          Why professional care
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container about-statement">
          <p className="eyebrow">The intended standard</p>
          <h2>
            Make the next decision understandable — whether that means cleaning,
            reducing intensity or recommending a different route.
          </h2>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container">
          <SectionHeading
            eyebrow="Working principles"
            title="Care is a sequence of decisions."
          />
          <div className="principle-grid principle-grid--four">
            {principles.map((principle, index) => (
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
            <p className="eyebrow">Original proof matters</p>
            <h2>Real people, real equipment and permission-based examples.</h2>
            <p>
              Public photography should show actual technicians, genuine on-site
              work, fabric details and carefully documented examples. Deliberate
              placeholders are used until that original material is available,
              rather than stock claims or fabricated before-and-after evidence.
            </p>
            <p className="fine-print">
              No years in business, customer counts, awards, certifications,
              reviews or ratings are claimed at this stage.
            </p>
          </div>
          <PhotoPlaceholder
            title="The future service team"
            note="Real technicians and equipment, photographed in authentic Sofia settings with permission."
          />
        </div>
      </section>

      <CallToAction />
    </>
  );
}
