import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "../button-link";
import { CallToAction } from "../call-to-action";
import { FaqList } from "../faq-list";
import { PageHero } from "../page-hero";

export function FaqPage({ locale }: { locale: PublicLocale }) {
  const content = getPublicContent(locale);
  const copy = content.pages.faq;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/faq" },
        ]}
        aside={
          <div className="faq-hero-card">
            <span>{content.faqs.length}</span>
            <p>{copy.hero.countLabel}</p>
            <ButtonLink
              href={localizePublicPath(locale, "/request")}
              variant="quiet"
            >
              {copy.hero.primaryAction}
            </ButtonLink>
          </div>
        }
      />

      <section className="section">
        <div className="site-container faq-page-grid">
          <aside>
            <p className="eyebrow">{copy.certainty.eyebrow}</p>
            <h2>{copy.certainty.title}</h2>
            <p>{copy.certainty.description}</p>
          </aside>
          <FaqList faqs={content.faqs} />
        </div>
      </section>

      <CallToAction locale={locale} {...copy.cta} />
    </>
  );
}
