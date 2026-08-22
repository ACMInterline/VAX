import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";

type FabricVisualProps = {
  locale: PublicLocale;
  variant?: "hero" | "care" | "business";
  label?: string;
};

export function FabricVisual({
  locale,
  variant = "hero",
  label,
}: FabricVisualProps) {
  const copy = getPublicContent(locale).common.visuals;

  return (
    <div
      className={`fabric-visual fabric-visual--${variant}`}
      role="img"
      aria-label={label ?? copy.abstractFabric}
    >
      <div className="fabric-visual__grid" aria-hidden="true" />
      <div
        className="fabric-visual__orb fabric-visual__orb--one"
        aria-hidden="true"
      />
      <div
        className="fabric-visual__orb fabric-visual__orb--two"
        aria-hidden="true"
      />
      <div className="fabric-visual__card" aria-hidden="true">
        <span>{copy.surface}</span>
        <strong>{copy.assessedFirst}</strong>
        <i />
      </div>
      <div className="fabric-visual__caption" aria-hidden="true">
        <span>{copy.onSite}</span>
        <span>Sofia</span>
      </div>
    </div>
  );
}

export function PhotoPlaceholder({
  locale,
  title,
  note,
}: {
  locale: PublicLocale;
  title: string;
  note: string;
}) {
  const label = getPublicContent(locale).common.visuals.originalPhotography;

  return (
    <div className="photo-placeholder" role="img" aria-label={`${title}. ${note}`}>
      <div className="photo-placeholder__weave" aria-hidden="true" />
      <div className="photo-placeholder__label">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}
