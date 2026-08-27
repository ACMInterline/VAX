export default function CommunicationsLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Комуникации</p>
        <h1>Зареждане на комуникациите…</h1>
        <p>Моля, изчакайте.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Communications</p>
        <h1>Loading communications…</h1>
        <p>Please wait.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true"><span /><span /></div>
    </section>
  );
}
