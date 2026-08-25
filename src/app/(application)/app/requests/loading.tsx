export default function RequestsLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg"><p className="eyebrow">Операции</p><h1>Зареждане на заявките…</h1><p>Моля, изчакайте.</p></div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en"><p className="eyebrow">Operations</p><h1>Loading service requests…</h1><p>Please wait.</p></div>
      <div className="crm-route-state__skeleton" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}
