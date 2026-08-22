import Link from "next/link";
import { publicBrand } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { MobileNavigation } from "./mobile-navigation";

export function SiteHeader() {
  const { navigation } = getPublicContent();

  return (
    <header className="site-header">
      <div className="site-header__inner site-container">
        <Link className="wordmark" href="/" aria-label={`${publicBrand.name} home`}>
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

        <nav className="desktop-navigation" aria-label="Primary navigation">
          {navigation.primary.slice(0, 6).map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link className="header-cta" href={publicBrand.primaryCta.href}>
          Request care
          <span aria-hidden="true">↗</span>
        </Link>

        <MobileNavigation
          links={navigation.primary}
          cta={publicBrand.primaryCta}
        />
      </div>
    </header>
  );
}
