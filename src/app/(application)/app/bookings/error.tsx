"use client";

export default function BookingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="crm-route-state crm-route-state--error" role="alert">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Операции и график</p>
        <h1>Резервациите не можаха да се заредят</h1>
        <p>Опитайте отново. Ако проблемът продължи, проверете наблюдението.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Operations and schedule</p>
        <h1>Bookings could not be loaded</h1>
        <p>Try again. If the problem continues, check monitoring.</p>
      </div>
      <button
        className="crm-button crm-button--primary"
        type="button"
        onClick={reset}
      >
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
