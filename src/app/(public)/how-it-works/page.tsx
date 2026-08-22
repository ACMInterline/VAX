import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FabricVisual } from "@/components/public/fabric-visual";
import { PageHero } from "@/components/public/page-hero";
import { ProcessSteps } from "@/components/public/process-steps";
import { SectionHeading } from "@/components/public/section-heading";
import { TreatmentLevels } from "@/components/public/treatment-levels";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const content = getPublicContent();
const pageMetadata = content.metadata.howItWorks;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/how-it-works",
});

const steps = [
  {
    title: "Share useful context",
    description:
      "Describe the item, quantity or area, visible condition, stains, material clues, property and preferred time period. Photos will be added in a later phase.",
  },
  {
    title: "Prepare practical access",
    description:
      "Discuss parking, building rules, lifts, security, light furniture and the space needed around the item. Furniture movement is agreed, not assumed.",
  },
  {
    title: "Inspect the material",
    description:
      "Fibre, colour response, construction, backing, seams, wear, previous damage and contamination shape what is safe and worthwhile.",
  },
  {
    title: "Agree the treatment",
    description:
      "The cleaner confirms the treatment level, working sequence, realistic stain expectations and any reason to modify or stop the plan.",
  },
  {
    title: "Clean with control",
    description:
      "Method, chemistry, agitation and moisture are applied proportionately, with focused attention to the actual surface rather than a standard script.",
  },
  {
    title: "Handover and aftercare",
    description:
      "You receive practical guidance on ventilation, contact, positioning and return to use based on material, method and room conditions.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="From context to aftercare"
        title="A professional process should feel clear before it feels technical."
        description="The customer explains the situation. The cleaner assesses the material and risk. Together, those inputs create a practical treatment plan."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "How it works", path: "/how-it-works" },
        ]}
        aside={<FabricVisual variant="care" />}
      >
        <ButtonLink href="/request">Try the request prototype</ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Six considered steps"
            title="Enough structure to be dependable. Enough judgement to respect the material."
          />
          <ProcessSteps steps={steps} />
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container assessment-band">
          <div>
            <span className="assessment-band__number">01—05</span>
            <p>Five treatment levels communicate intensity and uncertainty.</p>
          </div>
          <div>
            <h2>The final level follows inspection.</h2>
            <p>
              A customer can describe soil, stains and material value, but should
              not need to choose chemical strength, moisture or mechanical action.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <TreatmentLevels levels={content.treatmentLevels} />
        </div>
      </section>

      <section className="section section--deep">
        <div className="site-container return-guidance">
          <div>
            <p className="eyebrow eyebrow--light">Return to use</p>
            <h2>“Dry” is not one universal number.</h2>
          </div>
          <div>
            <p>
              Material, method, airflow, temperature, humidity, contamination and
              treatment depth all matter. The goal is rapid, responsible reuse
              with guidance that reflects the actual job.
            </p>
            <p className="fine-print fine-print--light">
              Early and evening appointments are intended, subject to building
              rules, local requirements, job conditions and availability.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
