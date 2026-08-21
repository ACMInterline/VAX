export default function Home() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card" aria-labelledby="foundation-title">
        <div className="status-line">
          <span className="status-dot" aria-hidden="true" />
          <span>Phase 0A · Application foundation</span>
        </div>

        <div className="foundation-copy">
          <p className="eyebrow">Service-management platform</p>
          <h1 id="foundation-title">Project foundation is operational.</h1>
          <p className="summary">
            The application shell, database boundary, migration workflow, and
            health contract are ready for incremental product development.
          </p>
        </div>

        <dl className="foundation-facts">
          <div>
            <dt>Architecture</dt>
            <dd>Modular monolith</dd>
          </div>
          <div>
            <dt>Application</dt>
            <dd>Next.js App Router</dd>
          </div>
          <div>
            <dt>Persistence</dt>
            <dd>PostgreSQL via an isolated adapter</dd>
          </div>
        </dl>

        <p className="scope-note">
          Final branding, marketing content, booking, CRM, and operations
          workflows are intentionally outside this foundation phase.
        </p>
      </section>
    </main>
  );
}
