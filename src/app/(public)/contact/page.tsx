import { publicBrand } from "@/config/public-site";
import { ButtonLink } from "@/components/public/button-link";
import { PageHero } from "@/components/public/page-hero";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const pageMetadata = getPublicContent().metadata.contact;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact and service context"
        title="Start with the surface and the Sofia location."
        description="Phone and email channels are not yet published. The request prototype is available now to demonstrate the information a future connected service will need."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Contact", path: "/contact" },
        ]}
      >
        <ButtonLink href="/request">Open request prototype</ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container contact-grid">
          <article>
            <span className="contact-grid__label">Phone</span>
            <h2>{publicBrand.contact.phone.label}</h2>
            <p>
              The approved service number will appear here before telephone
              enquiries open.
            </p>
          </article>
          <article>
            <span className="contact-grid__label">Email</span>
            <h2>{publicBrand.contact.email.label}</h2>
            <p>
              The approved service mailbox will appear here before email
              enquiries open.
            </p>
          </article>
          <article>
            <span className="contact-grid__label">Service area</span>
            <h2>Sofia city</h2>
            <p>
              Surrounding areas may be considered subject to availability. Travel
              zones and charges are not yet published.
            </p>
          </article>
          <article className="contact-grid__hours">
            <span className="contact-grid__label">Intended hours</span>
            <h2>Approximately 06:00—22:00</h2>
            <p>{publicBrand.operatingHours.detail}</p>
          </article>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container contact-next-step">
          <div>
            <p className="eyebrow">No walk-in office</p>
            <h2>The service is positioned around on-site visits.</h2>
            <p>
              No walk-in customer office is currently published. Any future
              customer-facing location should appear only when it is real,
              appropriate for visits and approved for publication.
            </p>
          </div>
          <div>
            <span>Best current next step</span>
            <h3>Describe the item, condition and preferred timing.</h3>
            <ButtonLink href="/request">Try the prototype</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
