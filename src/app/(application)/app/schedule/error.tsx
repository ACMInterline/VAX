"use client";

export default function ScheduleError({ reset }: { reset: () => void }) {
  return (
    <section className="crm-route-state crm-route-state--error" role="alert">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Операции и график</p>
        <h1>Графикът не можа да се зареди</h1>
        <p>
          Опитайте отново. Ако проблемът продължи, проверете наблюдението на
          приложението.
        </p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Operations and schedule</p>
        <h1>The schedule could not be loaded</h1>
        <p>
          Try again. If the problem continues, check application monitoring.
        </p>
      </div>
      <button className="crm-button" type="button" onClick={reset}>
        <span className="crm-route-state__copy--bg" lang="bg">
          Опитайте отново
        </span>
        <span className="crm-route-state__copy--en" lang="en">
          Try again
        </span>
      </button>
    </section>
  );
}
