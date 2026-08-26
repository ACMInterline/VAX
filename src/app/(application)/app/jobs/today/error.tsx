"use client";

export default function TodayJobsError({ reset }: { reset: () => void }) {
  return (
    <section className="crm-route-state" role="alert">
      <div className="crm-route-state__copy--bg" lang="bg">
        <h1>Днешните посещения не могат да се заредят</h1>
        <p>
          Опитайте отново. Ако проблемът продължи, свържете се с оторизиран
          служител.
        </p>
      </div>
      <div className="crm-route-state__copy--en" lang="en">
        <h1>Today&apos;s visits could not be loaded</h1>
        <p>
          Try again. If the problem continues, contact authorized staff.
        </p>
      </div>
      <button className="crm-button" type="button" onClick={reset}>
        Retry / Опитай отново
      </button>
    </section>
  );
}
