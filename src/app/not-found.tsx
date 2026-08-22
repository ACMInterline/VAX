import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div>
        <p className="eyebrow">404 · Surface not found</p>
        <h1>This page needs a different route.</h1>
        <p>
          Return to the public service guide or describe the item that needs
          care.
        </p>
        <div className="page-hero__actions">
          <Link className="button-link button-link--primary" href="/">
            <span>Return home</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button-link button-link--quiet" href="/services">
            <span>Explore services</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
