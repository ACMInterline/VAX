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
});
