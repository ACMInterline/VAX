export default function MyPropertiesLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Клиентска зона</p>
        <h1>Зареждане на вашите имоти…</h1>
        <p>Моля, изчакайте.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Customer area</p>
        <h1>Loading your properties…</h1>
        <p>Please wait.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true">
        <span />
        <span />
      </div>
    </section>
  );
}
