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
        <rect className="attelier-shape attelier-shape--cream" width="640" height="720" />
        <path className="attelier-shape attelier-shape--cobalt" d="M0 0h330l-76 262L0 322Z" />
        <path className="attelier-shape attelier-shape--yellow" d="m330 0 310 0v248L504 192 420 312 254 262Z" />
        <path className="attelier-shape attelier-shape--coral" d="M0 322 254 262l58 174-158 92L0 472Z" />
        <path className="attelier-shape attelier-shape--green" d="m420 312 84-120 136 56v284L488 466 312 436Z" />
        <path className="attelier-shape attelier-shape--pink" d="m0 472 154 56 116 192H0Z" />
        <path className="attelier-shape attelier-shape--blue" d="m154 528 158-92 176 30 152 66v188H270Z" />

        <g className="attelier-sofa">
          <path d="M168 438h296a28 28 0 0 1 28 28v108H140V466a28 28 0 0 1 28-28Z" />
          <path d="M122 494h38v116h-38a20 20 0 0 1-20-20v-76a20 20 0 0 1 20-20ZM492 494h38a20 20 0 0 1 20 20v76a20 20 0 0 1-20 20h-38Z" />
          <path d="M158 574h316v36H158Z" />
          <path d="M176 610h22v38h-22ZM434 610h22v38h-22Z" />
          <path className="attelier-sofa__line" d="M316 438v136" />
        </g>

        <g className="attelier-person">
          <circle cx="438" cy="224" r="48" />
          <path d="M400 270c34-18 76-6 94 26l46 84-58 30-42-62-34 86-90-30 44-106c8-18 22-26 40-28Z" />
          <path d="m370 296-98-62-28 40 112 94ZM474 292l72-84 34 30-70 112Z" />
          <path d="m350 402-30 134 48 8 48-126ZM424 420l42 128 48-15-28-146Z" />
        </g>

        <g className="attelier-plant">
          <path d="M74 410h74l-12 92H86Z" />
          <path d="M110 410c-1-70 14-126 45-166M110 410c-8-64-32-107-70-138M110 410c18-70 54-105 102-118" />
          <path className="attelier-plant__leaf" d="M143 266c22-44 54-56 82-47-2 37-28 65-73 68ZM52 284c-10-42-34-58-62-55 0 38 20 62 60 75ZM126 323c20-40 49-53 75-46-1 35-24 59-66 66Z" />
        </g>
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
        <rect className="attelier-shape attelier-shape--navy" width="900" height="720" />
        <path className="attelier-shape attelier-shape--yellow" d="M0 0h460L312 296 0 224Z" />
        <path className="attelier-shape attelier-shape--cobalt" d="m460 0 440 0v312L688 214 510 382 312 296Z" />
        <path className="attelier-shape attelier-shape--coral" d="M0 224 312 296l198 86-118 338H0Z" />
        <path className="attelier-shape attelier-shape--green" d="m510 382 178-168 212 98v408H392Z" />
        <path className="attelier-rug" d="m130 510 430-98 188 178-448 130Z" />
        <g className="attelier-person attelier-person--relaxed">
          <circle cx="650" cy="190" r="58" />
          <path d="M600 244c70-32 132 10 138 82l9 112-112 20-26-108-72 100-80-56 108-127c10-12 21-19 35-23Z" />
          <path d="m589 272-124-95-30 44 120 126ZM714 273l85-103 38 34-80 127Z" />
        </g>
        <path className="attelier-weave-line" d="m94 558 430-99M124 606l430-99M168 651l430-99" />
      </svg>
      <div className="photo-placeholder__label">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}
