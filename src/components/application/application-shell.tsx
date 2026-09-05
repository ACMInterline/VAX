import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/auth-actions";
import type { AuthLocale } from "@/auth/validation";
import type { AuthorizationContext } from "@/modules/identity-access/authorization";
import { visibleNavigationItems } from "@/modules/identity-access/navigation";

export function ApplicationShell({
  authorization,
  children,
  locale,
}: {
  authorization: AuthorizationContext;
  children: ReactNode;
  locale: AuthLocale;
}) {
  const isEnglish = locale === "en";
  const navigation = visibleNavigationItems(authorization);

  return (
    <div className="application-shell">
      <header className="application-header">
        <Link href={isEnglish ? "/en" : "/"} className="application-brand">
          <span>ATTELIER</span>
          <small>{isEnglish ? "Textile Care" : "Професионална грижа за текстила"}</small>
        </Link>
        <form action={logoutAction}>
          <button className="application-logout" type="submit">
            {isEnglish ? "Sign out" : "Изход"}
          </button>
        </form>
      </header>

      <main id="app-main" className="application-main">
        {children}

        <nav className="application-navigation" aria-labelledby="workspace-title">
          <div className="application-section-heading">
            <p className="eyebrow" id="workspace-title">
              {isEnglish ? "Permission-aware navigation" : "Навигация според правата"}
            </p>
            <p>
              {isEnglish
                ? "Navigation visibility is a convenience; every server operation authorizes again."
                : "Видимостта на навигацията е улеснение; всяка сървърна операция проверява правата отново."}
            </p>
          </div>
          <ul>
            {navigation.map((item) => (
              <li key={item.code}>
                {item.href ? (
                  <Link className="application-navigation__link" href={item.href}>
                    {isEnglish ? item.labelEn : item.labelBg}
                  </Link>
                ) : (
                  <span>{isEnglish ? item.labelEn : item.labelBg}</span>
                )}
                <small>
                  {item.audience === "CUSTOMER"
                    ? isEnglish
                      ? "Customer area"
                      : "Клиентска зона"
                    : item.audience === "STAFF"
                      ? isEnglish
                        ? "Staff area"
                        : "Зона за екипа"
                      : isEnglish
                        ? "Shared account area"
                        : "Обща зона за профила"}
                </small>
                <em>
                  {item.href
                    ? isEnglish
                      ? "Open module"
                      : "Отваряне на модула"
                    : isEnglish
                      ? "Future module"
                      : "Бъдещ модул"}
                </em>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
