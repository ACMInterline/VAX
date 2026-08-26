export default function JobsLoading() {
  return (
    <section className="crm-route-state" aria-live="polite" aria-busy="true">
      <div className="crm-route-state__copy--bg" lang="bg"><h1>Зареждане на работните задачи</h1><p>Подготвяме актуалния оперативен изглед.</p></div>
      <div className="crm-route-state__copy--en" lang="en"><h1>Loading field jobs</h1><p>Preparing the current operational view.</p></div>
      <div className="crm-route-state__skeleton" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}
