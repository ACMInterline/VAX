import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FabricVisual } from "@/components/public/fabric-visual";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { TreatmentLevels } from "@/components/public/treatment-levels";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const content = getPublicContent();
const pageMetadata = content.metadata.services;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Professional care by surface"
        title="Different fabrics ask different questions."
        description="Explore on-site care for carpets, rugs, upholstery and mattresses. Each service begins with material, construction, condition and access — then moves to an appropriate treatment."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Services", path: "/services" },
        ]}
        aside={<FabricVisual variant="care" />}
      >
        <ButtonLink href="/request">Describe what needs care</ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Six service paths"
            title="Start with the surface, not a sales package."
            description="These pages explain intended use, care decisions and limitations without turning estimates into guarantees."
          />
          <div className="service-grid">
            {content.services.map((service, index) => (
              <ServiceCard key={service.slug} service={service} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container capacity-feature">
          <div>
            <p className="eyebrow">Professional processing</p>
            <strong>Up to approximately 25 m² per hour can be possible</strong>
          </div>
          <p>
            This is a contextual capacity indicator, not a universal service-time
            promise. Surface type, treatment level, condition, access and focused
            stain work can all change the pace.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Treatment vocabulary"
            title="Intensity is assessed, not self-prescribed."
            description="The five levels help explain scope while keeping material and risk decisions with the professional assessment."
          />
          <TreatmentLevels levels={content.treatmentLevels} />
        </div>
      </section>

      <CallToAction />
    </>
  );
}
