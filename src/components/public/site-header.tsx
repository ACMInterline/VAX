import Link from "next/link";
import { publicBrand, type PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNavigation } from "./mobile-navigation";

export function SiteHeader({ locale }: { locale: PublicLocale }) {
  const { common, navigation } = getPublicContent(locale);
  const localizedLinks = navigation.primary.map((link) => ({
    ...link,
    href: localizePublicPath(locale, link.href),
  }));
  const requestLink = {
    label: common.brand.primaryCta,
    href: localizePublicPath(locale, "/request"),
  };
  const homeHref = localizePublicPath(locale, "/");

  return (
    <header className="site-header">
      <div className="site-header__inner site-container">
        <Link
          className="wordmark"
          href={homeHref}
          aria-label={`${publicBrand.name} — ${common.serviceDetail.home}`}
        >
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

        <nav
          className="desktop-navigation"
          aria-label={common.accessibility.primaryNavigation}
        >
          {localizedLinks.slice(0, 5).map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <LanguageSwitcher
          locale={locale}
          label={common.accessibility.languageSelector}
          languageNames={common.languageNames}
        />

        <Link className="header-cta" href={requestLink.href}>
          {common.headerRequest}
          <span aria-hidden="true">↗</span>
        </Link>

        <MobileNavigation
          links={localizedLinks}
          cta={requestLink}
          navigationLabel={common.accessibility.mobileNavigation}
          openLabel={common.accessibility.openNavigation}
          closeLabel={common.accessibility.closeNavigation}
        />
      </div>
    </header>
  );
}
