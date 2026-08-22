import Link from "next/link";
import { publicBrand, type PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";

export function SiteFooter({ locale }: { locale: PublicLocale }) {
  const { common, navigation } = getPublicContent(locale);
  const homeHref = localizePublicPath(locale, "/");
  const requestHref = localizePublicPath(locale, "/request");

  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer__lead">
          <div>
            <p className="eyebrow eyebrow--light">{common.footer.eyebrow}</p>
            <h2>{common.brand.tagline}</h2>
          </div>
          <Link className="footer-request" href={requestHref}>
            {common.brand.primaryCta}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link className="wordmark wordmark--footer" href={homeHref}>
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
            <p>{common.brand.descriptor}</p>
            <p>{common.brand.serviceArea}</p>
          </div>

          <div>
            <h3>{common.footer.services}</h3>
            <ul>
              {navigation.serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={localizePublicPath(locale, link.href)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>{common.footer.explore}</h3>
            <ul>
              {navigation.primary.map((link) => (
                <li key={link.href}>
                  <Link href={localizePublicPath(locale, link.href)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__contact">
            <h3>{common.footer.contact}</h3>
            <p>{common.brand.phonePlaceholder}</p>
            <p>{common.brand.emailPlaceholder}</p>
            <p>{common.brand.appointmentShort}</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>
            © {new Date().getFullYear()} {publicBrand.name}.{" "}
            {common.footer.assessmentNotice}
          </p>
          <p>{common.footer.prototypeNotice}</p>
        </div>
      </div>
    </footer>
  );
}
