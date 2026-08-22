type FabricVisualProps = {
  variant?: "hero" | "care" | "business";
  label?: string;
};

export function FabricVisual({
  variant = "hero",
  label = "Abstract woven-fabric study reserved for future original photography",
}: FabricVisualProps) {
  return (
    <div className={`fabric-visual fabric-visual--${variant}`} role="img" aria-label={label}>
      <div className="fabric-visual__grid" aria-hidden="true" />
      <div className="fabric-visual__orb fabric-visual__orb--one" aria-hidden="true" />
      <div className="fabric-visual__orb fabric-visual__orb--two" aria-hidden="true" />
      <div className="fabric-visual__card" aria-hidden="true">
        <span>Surface</span>
        <strong>Assessed first</strong>
        <i />
      </div>
      <div className="fabric-visual__caption" aria-hidden="true">
        <span>On site</span>
        <span>Sofia</span>
      </div>
    </div>
  );
}

export function PhotoPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="photo-placeholder" role="img" aria-label={`${title}. ${note}`}>
      <div className="photo-placeholder__weave" aria-hidden="true" />
      <div className="photo-placeholder__label">
        <span>Original photography planned</span>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}
