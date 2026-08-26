export default function TodayJobsLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy--bg" lang="bg">
        <h1>Зареждане на днешните посещения…</h1>
        <p>Проверяваме текущо назначения екип и задачи.</p>
      </div>
      <div className="crm-route-state__copy--en" lang="en">
        <h1>Loading today&apos;s visits…</h1>
        <p>Checking the currently assigned team and jobs.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true">
        <span />
        <span />
      </div>
    </section>
  );
}
