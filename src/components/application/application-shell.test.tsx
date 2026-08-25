import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AuthorizationContext } from "@/modules/identity-access/authorization";

vi.mock("@/app/auth-actions", () => ({
  logoutAction: vi.fn(),
}));

import { ApplicationShell } from "./application-shell";

function authorization(
  permissions: AuthorizationContext["permissions"] = new Set(["IDENTITY_SELF_READ"]),
): AuthorizationContext {
  return {
    status: "ACTIVE",
    roles: new Set(),
    permissions,
  };
}

describe("protected application shell", () => {
  it.each([
    ["bg", "/", "Защитено приложение", "Изход", "Навигация според правата"],
    ["en", "/en", "Protected application", "Sign out", "Permission-aware navigation"],
  ] as const)(
    "renders shared %s application chrome around nested content",
    (locale, homeHref, applicationLabel, logoutLabel, navigationLabel) => {
      const html = renderToStaticMarkup(
        <ApplicationShell locale={locale} authorization={authorization()}>
          <h1>Nested route content</h1>
        </ApplicationShell>,
      );

      expect(html).toContain(`href="${homeHref}"`);
      expect(html).toContain(applicationLabel);
      expect(html).toContain(logoutLabel);
      expect(html).toContain(navigationLabel);
      expect(html).toContain('<main id="app-main"');
      expect(html).toContain("Nested route content");
    },
  );

  it.each([
    ["bg", "Администрация", "Отваряне на модула"],
    ["en", "Administration", "Open module"],
  ] as const)(
    "renders administration as a real %s users link for user administrators",
    (locale, label, actionLabel) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(new Set(["USER_ADMIN_READ"]))}
        >
          <h1>Admin route</h1>
        </ApplicationShell>,
      );

      expect(html).toContain('href="/app/admin/users"');
      expect(html).toContain(label);
      expect(html).toContain(actionLabel);
    },
  );

  it.each([
    ["bg", "Клиенти", "Моите имоти"],
    ["en", "Customers", "My properties"],
  ] as const)(
    "renders localized %s staff and customer CRM links for matching permissions",
    (locale, customersLabel, propertiesLabel) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(
            new Set(["CUSTOMER_RECORDS_READ", "OWN_CUSTOMER_DATA_READ"]),
          )}
        >
          <h1>CRM route</h1>
        </ApplicationShell>,
      );

      expect(html).toContain('href="/app/customers"');
      expect(html).toContain(customersLabel);
      expect(html).toContain('href="/app/my-properties"');
      expect(html).toContain(propertiesLabel);
    },
  );

  it.each([
    ["bg", "Заявки", "Моите заявки", "Моите оферти"],
    ["en", "Requests", "My requests", "My quotes"],
  ] as const)(
    "renders localized %s request and quote links only for matching permission sets",
    (locale, requestsLabel, myRequestsLabel, myQuotesLabel) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(
            new Set([
              "CUSTOMER_RECORDS_READ",
              "OPERATIONS_READ",
              "OWN_CUSTOMER_DATA_READ",
            ]),
          )}
        >
          <h1>Request routes</h1>
        </ApplicationShell>,
      );

      expect(html).toContain('href="/app/requests"');
      expect(html).toContain(requestsLabel);
      expect(html).toContain('href="/app/my-requests"');
      expect(html).toContain(myRequestsLabel);
      expect(html).toContain('href="/app/my-quotes"');
      expect(html).toContain(myQuotesLabel);

      const operationsOnly = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(new Set(["OPERATIONS_READ"]))}
        >
          <h1>Technician-style navigation</h1>
        </ApplicationShell>,
      );
      expect(operationsOnly).not.toContain('href="/app/requests"');
    },
  );
});
