import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { RequestForm } from "@/modules/public-request/request-form";
import type { PublicRequestFormAction } from "@/modules/public-request/action-state";
import { PageHero } from "../page-hero";

export function RequestPage({
  action,
  locale,
}: {
  action: PublicRequestFormAction;
  locale: PublicLocale;
}) {
  const content = getPublicContent(locale);
  const copy = content.pages.request;

  return (
    <>
      <PageHero
        locale={locale}
        {...copy.hero}
        breadcrumbs={[
          { label: copy.breadcrumbs.home, href: "/" },
          { label: copy.breadcrumbs.current, path: "/request" },
        ]}
        aside={
          <div className="request-hero-card">
            <span>{copy.hero.checklistTitle}</span>
            <ul>
              {copy.hero.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        }
      />

      <section className="section request-section">
        <div className="site-container request-layout">
          <aside className="request-layout__aside">
            <p className="eyebrow">{copy.intro.eyebrow}</p>
            <h2>{copy.intro.title}</h2>
            <p>{copy.intro.description}</p>
            <div className="prototype-boundary">
              <span>{copy.boundaryLabel}</span>
              <ul>
                {copy.boundaryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
          <RequestForm action={action} locale={locale} />
        </div>
      </section>
    </>
  );
}
