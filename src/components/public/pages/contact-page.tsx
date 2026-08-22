import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { PageHero } from "../page-hero";

export function ContactPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.contact;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/contact" },
        ]}
      >
        <ButtonLink href={localizePublicPath(locale, "/request")}>
          {copy.hero.primaryAction}
        </ButtonLink>
      </PageHero>

      <section className="section">
        <div className="site-container contact-grid">
          <article>
            <span className="contact-grid__label">{copy.cards.phone.label}</span>
            <h2>{content.common.brand.phonePlaceholder}</h2>
            <p>{copy.cards.phone.text}</p>
          </article>
          <article>
            <span className="contact-grid__label">{copy.cards.email.label}</span>
            <h2>{content.common.brand.emailPlaceholder}</h2>
            <p>{copy.cards.email.text}</p>
          </article>
          <article>
            <span className="contact-grid__label">{copy.cards.area.label}</span>
            <h2>{copy.cards.area.title}</h2>
            <p>{copy.cards.area.text}</p>
          </article>
          <article className="contact-grid__hours">
            <span className="contact-grid__label">{copy.cards.hours.label}</span>
            <h2>{copy.cards.hours.title}</h2>
            <p>{content.common.brand.appointmentDetail}</p>
          </article>
        </div>
      </section>

      <section className="section section--soft">
        <div className="site-container contact-next-step">
          <div>
            <p className="eyebrow">{copy.visit.eyebrow}</p>
            <h2>{copy.visit.title}</h2>
            <p>{copy.visit.text}</p>
          </div>
          <div>
            <span>{copy.visit.nextLabel}</span>
            <h3>{copy.visit.nextTitle}</h3>
            <ButtonLink href={localizePublicPath(locale, "/request")}>
              {copy.visit.action}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
