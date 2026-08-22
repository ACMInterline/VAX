import Link from "next/link";
import { publicBrand } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { ButtonLink } from "./button-link";
import { CallToAction } from "./call-to-action";
import { FabricVisual, PhotoPlaceholder } from "./fabric-visual";
import { FaqList } from "./faq-list";
import { ProcessSteps } from "./process-steps";
import { SectionHeading } from "./section-heading";
import { ServiceCard } from "./service-card";
import { TreatmentLevels } from "./treatment-levels";
import { TrustStrip } from "./trust-strip";

const processSteps = [
  {
    title: "Describe the surface",
    description:
      "Share the item, approximate size, condition, stains, material clues and access needs.",
  },
  {
    title: "Inspect before intensity",
    description:
      "Fibre, colour response, construction, wear and the working environment shape the plan.",
  },
  {
    title: "Confirm the treatment",
    description:
      "The appropriate level and realistic outcome are explained before work proceeds.",
  },
  {
    title: "Clean with control",
    description:
      "Method, chemistry, agitation and moisture are selected for the actual surface.",
  },
  {
    title: "Return to use thoughtfully",
    description:
      "You receive practical ventilation, drying and aftercare guidance for the conditions.",
  },
] as const;

export function HomePage() {
  const content = getPublicContent();

  return (
    <>
      <section className="home-hero">
        <div className="site-container home-hero__grid">
          <div className="home-hero__copy">
            <p className="hero-kicker">
              <span aria-hidden="true" />
              Professional fabric care · Sofia
            </p>
            <h1>{publicBrand.tagline}</h1>
            <p className="home-hero__summary">
              On-site carpet, rug, upholstery and mattress cleaning for homes,
              offices and hospitality spaces — planned for less disruption,
              careful material decisions and a practical return to use.
            </p>
            <div className="home-hero__actions">
              <ButtonLink href={publicBrand.primaryCta.href}>
                {publicBrand.primaryCta.label}
              </ButtonLink>
              <ButtonLink href="/services" variant="quiet">
                Explore services
              </ButtonLink>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>Where</dt>
                <dd>Homes, offices & hospitality</dd>
              </div>
              <div>
                <dt>Approach</dt>
                <dd>Assessment-led, on site</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>Sofia city</dd>
              </div>
            </dl>
          </div>
          <div className="home-hero__visual">
            <FabricVisual />
            <div className="capacity-card">
              <span className="capacity-card__value">≈25 m²</span>
              <span>per hour can be possible</span>
              <p>Depending on surface, treatment level and condition.</p>
            </div>
          </div>
        </div>
      </section>

      <TrustStrip />

      <section className="section section--services" id="services-overview">
        <div className="site-container">
          <SectionHeading
            eyebrow="Care by surface"
            title="One standard of attention. Different material decisions."
            description="The service starts with what the item is, how it is built and what has happened to it — not a universal cleaning recipe."
            action={
              <ButtonLink href="/services" variant="quiet">
                View all services
              </ButtonLink>
            }
          />
          <div className="service-grid">
            {content.services.map((service, index) => (
              <ServiceCard key={service.slug} service={service} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--deep">
        <div className="site-container on-site-grid">
          <div className="on-site-copy">
            <p className="eyebrow eyebrow--light">Care that comes to the item</p>
            <h2>Less transport. Less interruption. More context.</h2>
            <p>
              Suitable carpets, rugs and upholstered furniture can often be
              treated where they already live. That keeps the cleaner close to
              the room, access conditions and the way the surface is actually
              used.
            </p>
            <div className="on-site-points">
              <div>
                <span>01</span>
                <p>Many suitable items stay on site</p>
              </div>
              <div>
                <span>02</span>
                <p>Furniture access is agreed for the job</p>
              </div>
              <div>
                <span>03</span>
                <p>Portable equipment chosen for practical disruption</p>
              </div>
            </div>
            <p className="fine-print fine-print--light">
              Some rugs and delicate items may need a specialist route. No
              promise is made that furniture never needs to move.
            </p>
          </div>
          <PhotoPlaceholder
            title="Technician working on site"
            note="Future image: real equipment in an occupied Sofia interior, without staged before-and-after claims."
          />
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container reuse-grid">
          <div className="reuse-grid__lead">
            <p className="eyebrow">Rapid reuse, responsibly framed</p>
            <h2>The room should get back to its purpose.</h2>
            <p>
              Moisture and treatment depth are managed with return to use in
              mind. The actual timing is explained for the material and the
              conditions — never reduced to one blanket promise.
            </p>
            <ButtonLink href="/how-it-works" variant="quiet">
              Understand the process
            </ButtonLink>
          </div>
          <div className="reuse-factors" aria-label="Return-to-use factors">
            {["Material", "Method", "Airflow", "Temperature", "Humidity", "Treatment depth"].map(
              (factor, index) => (
                <div key={factor}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{factor}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Five treatment levels"
            title="You describe the condition. We assess the treatment."
            description="A clear vocabulary helps discuss scope without asking customers to prescribe chemistry, agitation or risk for themselves."
          />
          <TreatmentLevels levels={content.treatmentLevels} />
        </div>
      </section>

      <section className="section section--bordered">
        <div className="site-container care-balance-grid">
          <div className="care-balance-grid__statement">
            <p className="eyebrow">Clean well. Preserve intelligently.</p>
            <h2>
              Best reasonable result
              <span>+</span>
              minimum unnecessary material stress
            </h2>
          </div>
          <div className="care-balance-grid__details">
            <p>
              Professional care weighs visible improvement against fibre
              sensitivity, colourfastness, brushing intensity, chemistry,
              existing wear and age.
            </p>
            <ul className="check-list check-list--columns">
              <li>Fibre and construction</li>
              <li>Colour response</li>
              <li>Existing wear</li>
              <li>Chemical selection</li>
              <li>Agitation intensity</li>
              <li>Longer useful life</li>
            </ul>
            <p className="fine-print">
              Not every stain can be safely removed. Delicate, valuable or
              uncertain materials may require a gentler plan or specialist
              assessment.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--hygiene">
        <div className="site-container hygiene-grid">
          <div>
            <p className="eyebrow">Hygiene-conscious, evidence-conscious</p>
            <h2>Deeper maintenance without medical theatre.</h2>
          </div>
          <blockquote>
            “Deep professional cleaning can help remove accumulated soil, dust
            and residues that routine vacuuming may leave behind.”
          </blockquote>
          <div className="hygiene-note">
            <span>Claim boundary</span>
            <p>
              This is a fabric-care service. Specific product-performance or
              personal-health claims require evidence review before publication.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Homes and working spaces"
            title="The same care standard, adapted to the setting."
            description="Access, traffic, privacy, timing and return-to-use needs differ. The service plan should reflect that."
          />
          <div className="audience-grid">
            <article>
              <span>Residential</span>
              <h3>Care around daily life.</h3>
              <p>
                Apartments, houses, rented homes, landlords and tenants — with
                clear access needs and practical aftercare.
              </p>
              <ul>
                <li>Carpets and rugs</li>
                <li>Sofas and dining chairs</li>
                <li>Mattresses</li>
              </ul>
            </article>
            <article className="audience-grid__business">
              <span>Business</span>
              <h3>Care around operations.</h3>
              <p>
                Offices, hotels, serviced accommodation, property managers and
                suitable public-facing spaces — planned around access windows.
              </p>
              <ul>
                <li>Phased surface planning</li>
                <li>Early or later requests</li>
                <li>Clear handover guidance</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--process">
        <div className="site-container">
          <SectionHeading
            eyebrow="How it works"
            title="A calm route from description to aftercare."
          />
          <ProcessSteps steps={processSteps} />
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
            <p className="eyebrow">Initially serving Sofia</p>
            <h2>Professional fabric care across the city.</h2>
            <p>
              The initial service area is Sofia city. Surrounding areas may be
              considered subject to availability; district zones and travel
              pricing belong to a later pricing phase.
            </p>
            <div className="area-callout__actions">
              <ButtonLink href="/service-area">View service area</ButtonLink>
              <span>{publicBrand.operatingHours.shortLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container faq-home-grid">
          <div>
            <p className="eyebrow">Useful answers</p>
            <h2>Before someone visits.</h2>
            <p>
              Clear expectations are part of professional care — especially
              around access, stains, drying and delicate materials.
            </p>
            <Link href="/faq" className="text-link">
              Read every question <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <FaqList faqs={content.faqs} limit={5} />
        </div>
      </section>

      <CallToAction />
    </>
  );
}
