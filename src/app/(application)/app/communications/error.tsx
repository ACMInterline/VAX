"use client";

export default function CommunicationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="crm-route-state crm-route-state--error" role="alert">
      <div className="crm-route-state__copy crm-route-state__copy--bg" lang="bg">
        <p className="eyebrow">Комуникации</p><h1>Комуникациите не можаха да се заредят</h1><p>Опитайте отново.</p>
      </div>
      <div className="crm-route-state__copy crm-route-state__copy--en" lang="en">
        <p className="eyebrow">Communications</p><h1>Communications could not be loaded</h1><p>Try again.</p>
      </div>
      <button className="crm-button crm-button--primary" type="button" onClick={reset}>
        <span className="crm-route-state__copy--bg" lang="bg">Опитайте отново</span>
        <span className="crm-route-state__copy--en" lang="en">Try again</span>
      </button>
    </section>
  );
}
