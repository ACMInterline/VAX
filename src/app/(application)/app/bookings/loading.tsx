export default function BookingsLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Операции и график</p>
        <h1>Зареждане на резервациите…</h1>
        <p>Моля, изчакайте.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Operations and schedule</p>
        <h1>Loading bookings…</h1>
        <p>Please wait.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true">
        <span />
        <span />
      </div>
    </section>
  );
}
