import type { Metadata } from "next";
import { requireDevelopmentServer } from "../development-only";
import { PricingLab } from "./pricing-lab";

export const metadata: Metadata = {
  title: "Development Pricing Lab",
  description: "Local-only provisional VAX pricing and duration calculator.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function PricingLabPage() {
  requireDevelopmentServer();

  return (
    <main className="pricing-lab-shell">
      <header className="pricing-lab-header">
        <div>
          <p className="pricing-lab-badge">DEVELOPMENT ONLY</p>
          <h1>Pricing & duration lab</h1>
          <p>
            Provisional Sofia assumptions for deterministic testing. Values are
            draft, unpublished and unsuitable for customer quotations.
          </p>
        </div>
        <dl>
          <div>
            <dt>Price book</dt>
            <dd>SOFIA_RESIDENTIAL_V1_DRAFT</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>EUR · gross B2C basis</dd>
          </div>
        </dl>
      </header>
      <PricingLab />
      <footer className="pricing-lab-footer">
        This route is intentionally absent from public navigation and the
        sitemap. A no-index directive is not access control; the route must be
        authenticated or excluded before any deployment.
      </footer>
    </main>
  );
}
