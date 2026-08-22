import { RequestForm } from "@/modules/public-request/request-form";
import { PageHero } from "@/components/public/page-hero";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const pageMetadata = getPublicContent().metadata.request;

export const metadata = createPageMetadata({
  ...pageMetadata,
  path: "/request",
});

export default function RequestPage() {
  return (
    <>
      <PageHero
        eyebrow="Frontend prototype · No booking is created"
        title="Describe what needs professional care."
        description="This form demonstrates the future request model and validates information in your browser. It does not transmit, store, price, schedule or confirm anything."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Request prototype", path: "/request" },
        ]}
        aside={
          <div className="request-hero-card">
            <span>Before you start</span>
            <ul>
              <li>Know the Sofia area</li>
              <li>Select every relevant surface</li>
              <li>Describe stains or delicate material</li>
              <li>Choose a preferred time period</li>
            </ul>
          </div>
        }
      />

      <section className="section request-section">
        <div className="site-container request-layout">
          <aside className="request-layout__aside">
            <p className="eyebrow">What happens here</p>
            <h2>Validation, not reservation.</h2>
            <p>
              The browser checks whether required fields are complete and
              well-formed. A valid result is an interface demonstration only.
            </p>
            <div className="prototype-boundary">
              <span>Phase 1 boundary</span>
              <ul>
                <li>No database write</li>
                <li>No file upload</li>
                <li>No availability check</li>
                <li>No quote or price</li>
                <li>No booking confirmation</li>
              </ul>
            </div>
          </aside>
          <RequestForm />
        </div>
      </section>
    </>
  );
}
