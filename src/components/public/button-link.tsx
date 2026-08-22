import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      className={`button-link button-link--${variant} ${className}`.trim()}
      href={href}
    >
      <span>{children}</span>
      <span className="button-link__arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
