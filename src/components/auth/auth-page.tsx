import type { Metadata } from "next";
import Link from "next/link";
import type { AuthLocale } from "@/auth/validation";
import {
  authContent,
  localizedAuthPath,
  type AuthPageKind,
} from "@/content/auth";
import { AuthForm, EmailVerificationForms } from "./auth-form";

export function createAuthPageMetadata(
  locale: AuthLocale,
  kind: AuthPageKind,
): Metadata {
  const content = authContent[locale];
  const title =
    kind === "forgot-password"
      ? content.forgot.title
      : kind === "reset-password"
        ? content.reset.title
        : kind === "verify-email"
          ? content.verify.title
          : content[kind].title;
  return {
    title,
    robots: { index: false, follow: false, noarchive: true, nocache: true },
  };
}

export function AuthPage({
  kind,
  locale,
  resetToken,
}: {
  kind: AuthPageKind;
  locale: AuthLocale;
  resetToken?: string;
}) {
  const content = authContent[locale];
  const page =
    kind === "forgot-password"
      ? content.forgot
      : kind === "reset-password"
        ? content.reset
        : kind === "verify-email"
          ? content.verify
          : content[kind];
  const alternateLocale = locale === "bg" ? "en" : "bg";
  const route = `/${kind}`;

  return (
    <section className="auth-page">
      <div className="site-container auth-page__container">
        <div className="auth-card">
          <header className="auth-card__header">
            <div className="auth-card__toolbar">
              <Link href={locale === "en" ? "/en" : "/"} className="text-link">
                {content.common.backHome}
              </Link>
              <Link
                href={localizedAuthPath(alternateLocale, route)}
                hrefLang={alternateLocale}
                lang={alternateLocale}
                className="auth-locale-link"
              >
                <span aria-hidden="true">{content.common.switchLocaleCode}</span>
                <span className="sr-only">{content.common.switchLocale}</span>
              </Link>
            </div>
            <p className="eyebrow">{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </header>

          {kind === "verify-email" ? (
            <EmailVerificationForms locale={locale} />
          ) : kind === "reset-password" && !resetToken ? (
            <div className="auth-status auth-status--error" role="alert">
              {content.reset.missingToken}
            </div>
          ) : (
            <AuthForm kind={kind} locale={locale} resetToken={resetToken} />
          )}

          <footer className="auth-card__footer">
            {kind === "login" ? (
              <>
                <Link href={localizedAuthPath(locale, "/forgot-password")} className="text-link">
                  {content.login.forgot}
                </Link>
                <p>
                  {content.login.alternateLead}{" "}
                  <Link href={localizedAuthPath(locale, "/signup")}>
                    {content.login.alternateLink}
                  </Link>
                </p>
              </>
            ) : kind === "signup" ? (
              <p>
                {content.signup.alternateLead}{" "}
                <Link href={localizedAuthPath(locale, "/login")}>
                  {content.signup.alternateLink}
                </Link>
              </p>
            ) : kind === "reset-password" ? (
              <Link href={localizedAuthPath(locale, "/forgot-password")} className="text-link">
                {content.reset.alternateLink}
              </Link>
            ) : (
              <Link href={localizedAuthPath(locale, "/login")} className="text-link">
                {kind === "verify-email"
                  ? content.verify.alternateLink
                  : content.forgot.alternateLink}
              </Link>
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}
