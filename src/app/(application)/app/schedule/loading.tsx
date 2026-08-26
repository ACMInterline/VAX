export default function ScheduleLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Операции и график</p>
        <h1>Зареждане на графика…</h1>
        <p>Проверяваме актуалния оперативен капацитет.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Operations and schedule</p>
        <h1>Loading schedule…</h1>
        <p>Checking current operational capacity.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
