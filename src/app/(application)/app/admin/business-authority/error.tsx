"use client";

export default function BusinessAuthorityError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="crm-route-state crm-route-state--error" role="alert">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Бизнес управление</p>
        <h1>Пакетът не можа да се зареди</h1>
        <p>Не е направена промяна. Опитайте отново или проверете мониторинга.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Business governance</p>
        <h1>The package could not be loaded</h1>
        <p>No change was made. Try again or check monitoring.</p>
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
