const trustPoints = [
  ["01", "Assessment before treatment"],
  ["02", "Material-conscious decisions"],
  ["03", "On-site where appropriate"],
  ["04", "Clear return-to-use guidance"],
] as const;

export function TrustStrip() {
  return (
    <aside className="trust-strip" aria-label="Service principles">
      <div className="site-container trust-strip__grid">
        {trustPoints.map(([number, label]) => (
          <div key={number}>
            <span>{number}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
