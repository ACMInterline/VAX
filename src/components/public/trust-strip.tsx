import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";

export function TrustStrip({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);

  return (
    <aside
      className="trust-strip"
      aria-label={content.common.accessibility.servicePrinciples}
    >
      <div className="site-container trust-strip__grid">
        {content.pages.home.trustPoints.map((label, index) => (
          <div key={label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
