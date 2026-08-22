export function ProcessSteps({
  steps,
  compact = false,
}: {
  steps: readonly { title: string; description: string }[];
  compact?: boolean;
}) {
  return (
    <ol className={`process-steps${compact ? " process-steps--compact" : ""}`}>
      {steps.map((step, index) => (
        <li key={step.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
