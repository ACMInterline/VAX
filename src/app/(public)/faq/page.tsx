import { ButtonLink } from "@/components/public/button-link";
import { CallToAction } from "@/components/public/call-to-action";
import { FaqList } from "@/components/public/faq-list";
import { PageHero } from "@/components/public/page-hero";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const content = getPublicContent();
const pageMetadata = content.metadata.faq;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="Practical answers"
        title="Useful expectations before professional care."
        description="Answers about on-site work, access, timing, stains, delicate materials and the current limits of the Phase 1 service-request prototype."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "FAQ", path: "/faq" },
        ]}
        aside={
          <div className="faq-hero-card">
            <span>12</span>
            <p>carefully framed questions</p>
            <ButtonLink href="/request" variant="quiet">
              Describe your request
            </ButtonLink>
          </div>
        }
      />

      <section className="section">
        <div className="site-container faq-page-grid">
          <aside>
            <p className="eyebrow">A note on certainty</p>
            <h2>Inspection may refine any general answer.</h2>
            <p>
              Material, construction, condition, access and room conditions can
              change what is safe, useful and practical for a specific item.
            </p>
          </aside>
          <FaqList faqs={content.faqs} />
        </div>
      </section>

      <CallToAction
        eyebrow="Still specific to your item"
        title="A description is the right next step."
      />
    </>
  );
}
