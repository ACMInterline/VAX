import type { Metadata } from "next";
import { requireDevelopmentServer } from "../development-only";
import { AvailabilityLab } from "./availability-lab";

export const metadata: Metadata = {
  title: "Development Availability Lab",
  description: "Local-only VAX travel, capacity and slot calculator.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function AvailabilityLabPage() {
  requireDevelopmentServer();

  return (
    <main className="pricing-lab-shell availability-lab-shell">
      <header className="pricing-lab-header">
        <div>
          <p className="pricing-lab-badge">DEVELOPMENT ONLY</p>
          <h1>Availability & capacity lab</h1>
          <p>
            Pure, non-persistent scheduling scenarios for two provisional teams.
            No slot shown here is a reservation or customer promise.
          </p>
        </div>
        <dl>
          <div>
            <dt>Travel profile</dt>
            <dd>SOFIA_TRAVEL_V1_DRAFT</dd>
          </div>
          <div>
            <dt>Candidate interval</dt>
            <dd>30 minutes · draft</dd>
          </div>
        </dl>
      </header>
      <AvailabilityLab />
      <footer className="pricing-lab-footer">
        This route is absent from public navigation and the sitemap. No-index is
        not access control; exclude or authenticate the route before deployment.
      </footer>
    </main>
  );
}
