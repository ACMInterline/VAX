import { publicBrand } from "@/config/public-site";
import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FabricVisual } from "@/components/public/fabric-visual";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const pageMetadata = getPublicContent().metadata.serviceArea;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/service-area",
});

export default function ServiceAreaPage() {
  return (
    <>
      <PageHero
        eyebrow="Sofia service area"
        title="On-site fabric care planned around the city."
        description="The initial service area is Sofia city. Surrounding areas may be considered subject to availability, with exact zones and any travel pricing deliberately deferred to the pricing phase."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Service area", path: "/service-area" },
        ]}
        aside={<FabricVisual variant="business" label="Abstract Sofia service-area visual" />}
      >
        <ButtonLink href="/request">Share your Sofia area</ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container coverage-grid">
          <article className="coverage-card coverage-card--primary">
            <span>Current intended coverage</span>
            <h2>Sofia city</h2>
            <p>
              Residential and business requests across city districts can be
              described through the request prototype.
            </p>
          </article>
          <article className="coverage-card">
            <span>By discussion</span>
            <h2>Surrounding areas</h2>
            <p>
              Requests outside the city may be considered subject to route,
              availability and future pricing rules.
            </p>
          </article>
          <article className="coverage-card coverage-card--deferred">
            <span>Not published yet</span>
            <h2>Zones & travel charges</h2>
            <p>
              No district supplements or travel fees are published yet. They
              will follow a reviewed catalogue and pricing model.
            </p>
          </article>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container schedule-grid">
          <div>
            <p className="eyebrow">Appointment windows</p>
            <h2>Early and later requests are part of the intended model.</h2>
          </div>
          <div className="schedule-card">
            <span className="schedule-card__time">06:00—22:00</span>
            <p>{publicBrand.operatingHours.detail}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <SectionHeading
            eyebrow="Places we intend to serve"
            title="From private rooms to working premises."
            description="The service remains general fabric care; medical decontamination and specialist regulated cleaning are outside this service."
          />
          <div className="place-grid">
            {[
              "Apartments and houses",
              "Rented and managed homes",
              "Offices and waiting areas",
              "Hotels and guest houses",
              "Serviced apartments",
              "Suitable hospitality spaces",
              "Educational and public spaces",
              "Property common areas",
            ].map((place, index) => (
              <div key={place}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{place}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CallToAction
        eyebrow="Check the route"
        title="Tell us the district and the surfaces."
        description="The prototype can validate your service description, but it does not check availability, calculate travel or create an appointment."
      />
    </>
  );
}
