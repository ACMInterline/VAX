import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import type { TreatmentLevel } from "@/content/public-site/types";

export function TreatmentLevels({
  levels,
  locale,
}: {
  levels: readonly TreatmentLevel[];
  locale: PublicLocale;
}) {
  const note = getPublicContent(locale).common.treatmentNote;

  return (
    <div className="treatment-levels">
      {levels.map((level) => (
        <article key={level.number}>
          <div className="treatment-levels__number">{level.number}</div>
          <div>
            <p>{level.intendedFor}</p>
            <h3>{level.name}</h3>
            <span>{level.description}</span>
          </div>
        </article>
      ))}
      <p className="treatment-levels__note">{note}</p>
    </div>
  );
}
