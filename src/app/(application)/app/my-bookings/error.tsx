"use client";

export default function MyBookingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="crm-route-state crm-route-state--error" role="alert">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Клиентска зона</p>
        <h1>Резервациите не можаха да се заредят</h1>
        <p>Опитайте отново. Ако проблемът продължи, свържете се с екипа.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Customer area</p>
        <h1>Your bookings could not be loaded</h1>
        <p>Try again. If the problem continues, contact the team.</p>
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
