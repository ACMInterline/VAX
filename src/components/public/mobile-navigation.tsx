"use client";

import Link from "next/link";
import { useState } from "react";

type NavigationLink = {
  label: string;
  href: string;
};

type MobileNavigationProps = {
  links: readonly NavigationLink[];
  cta: NavigationLink;
};

export function MobileNavigation({ links, cta }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="mobile-navigation"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        className="mobile-navigation__toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="sr-only">
          {isOpen ? "Close navigation" : "Open navigation"}
        </span>
        <span className="mobile-navigation__lines" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      {isOpen ? (
        <div className="mobile-navigation__panel" id="mobile-navigation-panel">
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
          <Link
            className="mobile-navigation__cta"
            href={cta.href}
            onClick={() => setIsOpen(false)}
          >
            {cta.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
