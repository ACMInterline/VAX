import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import { visibleNavigationItems } from "@/modules/identity-access/navigation";
import { canonicalRoles } from "@/modules/identity-access/policy";
import { requireApplicationPrincipal } from "./application-principal";

export const dynamic = "force-dynamic";

export default async function ApplicationLandingPage() {
  const principal = await requireApplicationPrincipal();

  const locale = principal.profile.preferredLocale;
  const isEnglish = locale === "en";
  const roleLabels = canonicalRoles
    .filter((role) => principal.roles.has(role.code))
    .map((role) => (isEnglish ? role.labelEn : role.labelBg));
  const navigation = visibleNavigationItems({
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  });

  return (
    <div className="application-shell">
      <header className="application-header">
        <Link href={isEnglish ? "/en" : "/"} className="application-brand">
          <span>VAX</span>
          <small>{isEnglish ? "Protected application" : "Защитено приложение"}</small>
        </Link>
        <form action={logoutAction}>
          <button className="application-logout" type="submit">
            {isEnglish ? "Sign out" : "Изход"}
          </button>
        </form>
      </header>

      <main id="app-main" className="application-main">
        <section className="application-welcome" aria-labelledby="welcome-title">
          <p className="eyebrow">{isEnglish ? "Account workspace" : "Работно пространство"}</p>
          <h1 id="welcome-title">
            {isEnglish ? "Welcome" : "Добре дошли"}, {principal.profile.displayName}
          </h1>
          <p>
            {isEnglish
              ? "Identity and permission checks are active. Business modules will arrive in later phases."
              : "Проверките за идентичност и права са активни. Бизнес модулите ще бъдат добавени в следващи фази."}
          </p>
        </section>

        <section className="application-account" aria-labelledby="account-title">
          <div>
            <p className="eyebrow" id="account-title">
              {isEnglish ? "Safe account summary" : "Обобщение на профила"}
            </p>
            <dl>
              <div>
                <dt>{isEnglish ? "Status" : "Статус"}</dt>
                <dd>{isEnglish ? "Active" : "Активен"}</dd>
              </div>
              <div>
                <dt>{isEnglish ? "Email verification" : "Потвърждение на имейл"}</dt>
                <dd>
                  {principal.identity.emailVerified
                    ? isEnglish
                      ? "Verified"
                      : "Потвърден"
                    : isEnglish
                      ? "Not yet verified"
                      : "Все още не е потвърден"}
                </dd>
              </div>
              <div>
                <dt>{isEnglish ? "Interface language" : "Език"}</dt>
                <dd>{isEnglish ? "English" : "Български"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="eyebrow">{isEnglish ? "Application roles" : "Роли"}</p>
            {roleLabels.length > 0 ? (
              <ul className="application-role-list">
                {roleLabels.map((role) => <li key={role}>{role}</li>)}
              </ul>
            ) : (
              <p className="application-empty">
                {isEnglish ? "No access role is assigned." : "Няма зададена роля за достъп."}
              </p>
            )}
          </div>
        </section>

        <nav className="application-navigation" aria-labelledby="workspace-title">
          <div className="application-section-heading">
            <p className="eyebrow" id="workspace-title">
              {isEnglish ? "Permission-aware navigation" : "Навигация според правата"}
            </p>
            <p>
              {isEnglish
                ? "Visible items are previews only; every future server operation must authorize again."
                : "Видимите елементи са само преглед; всяка бъдеща сървърна операция трябва да проверява правата отново."}
            </p>
          </div>
          <ul>
            {navigation.map((item) => (
              <li key={item.code}>
                <span>{isEnglish ? item.labelEn : item.labelBg}</span>
                <small>
                  {item.audience === "CUSTOMER"
                    ? isEnglish ? "Customer area" : "Клиентска зона"
                    : item.audience === "STAFF"
                      ? isEnglish ? "Staff area" : "Зона за екипа"
                      : isEnglish ? "Shared account area" : "Обща зона за профила"}
                </small>
                <em>{isEnglish ? "Future module" : "Бъдещ модул"}</em>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
