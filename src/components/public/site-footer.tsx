import Link from "next/link";
import { publicBrand } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";

export function SiteFooter() {
  const { navigation } = getPublicContent();

  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer__lead">
          <div>
            <p className="eyebrow eyebrow--light">Care, considered</p>
            <h2>{publicBrand.tagline}</h2>
          </div>
          <Link className="footer-request" href={publicBrand.primaryCta.href}>
            {publicBrand.primaryCta.label}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link className="wordmark wordmark--footer" href="/">
              <span className="wordmark__mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="wordmark__text">
                <strong>{publicBrand.shortName}</strong>
                <small>Sofia</small>
              </span>
            </Link>
            <p>{publicBrand.descriptor}</p>
            <p>{publicBrand.serviceArea}</p>
          </div>

          <div>
            <h3>Services</h3>
            <ul>
              {navigation.serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Explore</h3>
            <ul>
              {navigation.primary.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__contact">
            <h3>Contact</h3>
            <p>{publicBrand.contact.phone.label}</p>
            <p>{publicBrand.contact.email.label}</p>
            <p>{publicBrand.operatingHours.shortLabel}</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>
            © {new Date().getFullYear()} {publicBrand.name}. Service details and
            timing remain subject to assessment.
          </p>
          <p>No booking or payment is created by this Phase 1 website.</p>
        </div>
      </div>
    </footer>
  );
}
