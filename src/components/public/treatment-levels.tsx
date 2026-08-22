import type { TreatmentLevel } from "@/content/public-site/types";

export function TreatmentLevels({ levels }: { levels: readonly TreatmentLevel[] }) {
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
      <p className="treatment-levels__note">
        You describe the condition. The appropriate treatment is confirmed after
        professional inspection.
      </p>
    </div>
  );
}
