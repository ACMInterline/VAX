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
      <svg
        className="fabric-visual__scene"
        viewBox="0 0 640 720"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect className="attelier-surface" width="640" height="720" />
        <path
          className="attelier-soft-weave"
          d="M-20 560 C100 500, 220 580, 340 520 S580 560, 680 510 L680 760 L-20 760 Z"
        />
        <path
          className="attelier-soft-weave"
          d="M-20 520 C140 460, 240 620, 380 560 S620 560, 680 520 L680 560 C560 580, 420 520, 340 620 S180 660, -20 620 Z"
        />
        <path
          className="attelier-soft-rug"
          d="M48 398 C220 332, 280 420, 450 370 S620 430, 592 398 L592 590 C470 648, 170 650, 48 590 Z"
        />

        <path
          className="attelier-soft-sofa"
          d="M132 500c16 0 28 12 28 28v94h320v-94c0-16 12-28 28-28h40c15 0 26 11 26 26v118c0 16-12 28-28 28H96c-16 0-28-12-28-28V526c0-15 11-26 26-26h38z"
        />
        <ellipse className="attelier-soft-sofa-pillows" cx="256" cy="538" rx="68" ry="34" />
        <ellipse className="attelier-soft-sofa-pillows" cx="374" cy="538" rx="68" ry="34" />
        <rect className="attelier-soft-stitch" x="236" y="514" width="168" height="10" rx="5" />

        <circle className="attelier-soft-face" cx="472" cy="234" r="30" />
        <path
          className="attelier-soft-figure"
          d="M438 274c20-18 52-8 67 14l34 64-40 22-29-48-28 76-72-30 31-82c8-16 21-24 38-26Z"
        />
        <path
          className="attelier-soft-figure"
          d="M415 292 334 244l-18 28 78 74Z M498 290l54-60 26 24-48 87"
        />

        <g className="attelier-soft-weave-mark">
          <circle cx="94" cy="438" r="8" />
          <circle cx="130" cy="466" r="6" />
          <path d="M76 474c14-20 38-22 58 2" />
        </g>

        <path
          className="attelier-soft-plant-stem"
          d="M96 430C76 390 74 330 103 276 C120 238 156 216 183 234"
        />
        <path
          className="attelier-soft-plant-leaf"
          d="M188 248c18-6 36-10 54 0C226 272 203 283 188 287Z"
        />
      </svg>
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
      <svg
        className="photo-placeholder__scene"
        viewBox="0 0 900 720"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect className="attelier-photo-surface" width="900" height="720" />
        <path
          className="attelier-soft-weave"
          d="M-20 420 C120 360, 250 500, 390 450 C520 404, 620 470, 920 430 L920 760 L-20 760 Z"
        />
        <path
          className="attelier-soft-rug"
          d="M22 486 C200 420, 320 530, 500 500 S780 530, 878 496 L878 648 C676 744, 246 742, 22 648 Z"
        />
        <ellipse className="attelier-soft-figure" cx="560" cy="210" rx="53" ry="40" />
        <path
          className="attelier-soft-figure"
          d="M522 253c44-32 98 6 102 68l8 90-92 16-21-88-57 84-66-44 88-126c8-11 18-16 33-20Z"
        />
        <path
          className="attelier-soft-figure"
          d="M510 275 405 190l-26 38 98 100Z M579 278 646 194 680 219 612 321"
        />
        <path
          className="attelier-soft-weave-mark"
          d="M140 592c20-16 58-16 74 2M160 620c16-12 44-10 58 4M190 646c10-13 34-15 46 1"
        />
        <circle className="attelier-soft-accent-dot" cx="730" cy="150" r="58" />
      </svg>
      <div className="photo-placeholder__label">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}
