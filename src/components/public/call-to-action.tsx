import { publicBrand } from "@/config/public-site";
import { ButtonLink } from "./button-link";

type CallToActionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function CallToAction({
  eyebrow = "Start with the surface",
  title = "Tell us what needs care.",
  description = "Share the material, condition, access and preferred timing. This Phase 1 prototype validates your information but does not create a booking.",
}: CallToActionProps) {
  return (
    <section className="cta-section">
      <div className="site-container cta-section__inner">
        <div>
          <p className="eyebrow eyebrow--light">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <ButtonLink href={publicBrand.primaryCta.href} variant="secondary">
          {publicBrand.primaryCta.label}
        </ButtonLink>
      </div>
    </section>
  );
}
