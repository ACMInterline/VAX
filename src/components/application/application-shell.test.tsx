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
    ["bg", "Бизнес правомощия"],
    ["en", "Business authority"],
  ] as const)(
    "renders the localized %s authority package only for settings readers",
    (locale, label) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(new Set(["SYSTEM_SETTINGS_READ"]))}
        >
          <h1>Authority route</h1>
        </ApplicationShell>,
      );

      expect(html).toContain('href="/app/admin/business-authority"');
      expect(html).toContain(label);
      expect(html).not.toContain('href="/app/admin/users"');
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
    ["bg", "Заявки", "Моите заявки", "Моите оферти", "Моите резервации", "Резервации", "График"],
    ["en", "Requests", "My requests", "My quotes", "My bookings", "Bookings", "Schedule"],
  ] as const)(
    "renders localized %s request, quote, and booking links only for matching permission sets",
    (
      locale,
      requestsLabel,
      myRequestsLabel,
      myQuotesLabel,
      myBookingsLabel,
      bookingsLabel,
      scheduleLabel,
    ) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(
            new Set([
              "CUSTOMER_RECORDS_READ",
              "OPERATIONS_READ",
              "SCHEDULE_READ",
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
      expect(html).toContain('href="/app/my-bookings"');
      expect(html).toContain(myBookingsLabel);
      expect(html).toContain('href="/app/bookings"');
      expect(html).toContain(bookingsLabel);
      expect(html).toContain('href="/app/schedule"');
      expect(html).toContain(scheduleLabel);

      const operationsOnly = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(new Set(["OPERATIONS_READ"]))}
        >
          <h1>Technician-style navigation</h1>
        </ApplicationShell>,
      );
      expect(operationsOnly).not.toContain('href="/app/requests"');
      expect(operationsOnly).not.toContain('href="/app/bookings"');
      expect(operationsOnly).not.toContain('href="/app/schedule"');
    },
  );

  it.each([
    ["bg", "Финанси", "Моите фактури"],
    ["en", "Finance", "My invoices"],
  ] as const)(
    "renders localized %s staff and customer finance links only for matching permissions",
    (locale, financeLabel, myInvoicesLabel) => {
      const html = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(
            new Set(["FINANCE_READ", "OWN_CUSTOMER_DATA_READ"]),
          )}
        >
          <h1>Finance routes</h1>
        </ApplicationShell>,
      );

      expect(html).toContain('href="/app/finance"');
      expect(html).toContain(financeLabel);
      expect(html).toContain('href="/app/my-invoices"');
      expect(html).toContain(myInvoicesLabel);

      const operationsOnly = renderToStaticMarkup(
        <ApplicationShell
          locale={locale}
          authorization={authorization(new Set(["OPERATIONS_READ"]))}
        >
          <h1>Operations route</h1>
        </ApplicationShell>,
      );
      expect(operationsOnly).not.toContain('href="/app/finance"');
      expect(operationsOnly).not.toContain('href="/app/my-invoices"');
    },
  );
});
