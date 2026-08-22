import type { ReactNode } from "react";
import type { AuthLocale } from "@/auth/validation";

const skipLink = {
  bg: "Към основното съдържание",
  en: "Skip to content",
} as const satisfies Record<AuthLocale, string>;

export function ApplicationDocument({
  children,
  locale,
}: {
  children: ReactNode;
  locale: AuthLocale;
}) {
  return (
    <html lang={locale}>
      <body className="application-body">
        <a className="skip-link" href="#app-main">
          {skipLink[locale]}
        </a>
        {children}
      </body>
    </html>
  );
}
