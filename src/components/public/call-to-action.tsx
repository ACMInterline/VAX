import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { ButtonLink } from "./button-link";

type CallToActionProps = {
  locale: PublicLocale;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function CallToAction({
  locale,
  eyebrow,
  title,
  description,
}: CallToActionProps) {
  const common = getPublicContent(locale).common;
  const defaultCopy = common.defaultCta;

  return (
    <section className="cta-section">
      <div className="site-container cta-section__inner">
        <div>
          <p className="eyebrow eyebrow--light">
            {eyebrow ?? defaultCopy.eyebrow}
          </p>
          <h2>{title ?? defaultCopy.title}</h2>
          <p>{description ?? defaultCopy.description}</p>
        </div>
        <ButtonLink
          href={localizePublicPath(locale, "/request")}
          variant="secondary"
        >
          {common.brand.primaryCta}
        </ButtonLink>
      </div>
    </section>
  );
}
