export default function BusinessAuthorityLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Бизнес управление</p>
        <h1>Зареждане на пакета…</h1>
        <p>Проверяваме текущите версии и одобрения.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Business governance</p>
        <h1>Loading the package…</h1>
        <p>Checking current versions and approvals.</p>
      </div>
      <div className="crm-route-state__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
