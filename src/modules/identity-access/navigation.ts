import {
  hasAnyPermission,
  hasPermission,
  type AuthorizationContext,
} from "./authorization";
import type { PermissionCode } from "./policy";

export type ApplicationNavigationItem = {
  code:
    | "ACCOUNT"
    | "CUSTOMER_WORKSPACE"
    | "MY_REQUESTS"
    | "MY_QUOTES"
    | "CUSTOMERS"
    | "REQUESTS"
    | "OPERATIONS"
    | "SCHEDULE"
    | "FIELD_WORK"
    | "ADMINISTRATION";
  labelBg: string;
  labelEn: string;
  futurePath?: string;
  href?: string;
  requiredPermissions: readonly PermissionCode[];
  permissionMatch?: "ANY" | "ALL";
  audience: "CUSTOMER" | "STAFF" | "SHARED";
};

export const applicationNavigationItems: readonly ApplicationNavigationItem[] = [
  {
    code: "ACCOUNT",
    labelBg: "Моят профил",
    labelEn: "My account",
    futurePath: "/app/account",
    requiredPermissions: ["IDENTITY_SELF_READ"],
    audience: "SHARED",
  },
  {
    code: "CUSTOMER_WORKSPACE",
    labelBg: "Моите имоти",
    labelEn: "My properties",
    href: "/app/my-properties",
    requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
    audience: "CUSTOMER",
  },
  {
    code: "MY_REQUESTS",
    labelBg: "Моите заявки",
    labelEn: "My requests",
    href: "/app/my-requests",
    requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
    audience: "CUSTOMER",
  },
  {
    code: "MY_QUOTES",
    labelBg: "Моите оферти",
    labelEn: "My quotes",
    href: "/app/my-quotes",
    requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
    audience: "CUSTOMER",
  },
  {
    code: "CUSTOMERS",
    labelBg: "Клиенти",
    labelEn: "Customers",
    href: "/app/customers",
    requiredPermissions: ["CUSTOMER_RECORDS_READ"],
    audience: "STAFF",
  },
  {
    code: "REQUESTS",
    labelBg: "Заявки",
    labelEn: "Requests",
    href: "/app/requests",
    requiredPermissions: ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ"],
    permissionMatch: "ALL",
    audience: "STAFF",
  },
  {
    code: "OPERATIONS",
    labelBg: "Операции",
    labelEn: "Operations",
    futurePath: "/app/operations",
    requiredPermissions: ["OPERATIONS_READ"],
    audience: "STAFF",
  },
  {
    code: "SCHEDULE",
    labelBg: "График",
    labelEn: "Schedule",
    futurePath: "/app/schedule",
    requiredPermissions: ["SCHEDULE_READ"],
    audience: "STAFF",
  },
  {
    code: "FIELD_WORK",
    labelBg: "Теренна работа",
    labelEn: "Field work",
    futurePath: "/app/jobs",
    requiredPermissions: ["FIELD_JOBS_READ"],
    audience: "STAFF",
  },
  {
    code: "ADMINISTRATION",
    labelBg: "Администрация",
    labelEn: "Administration",
    href: "/app/admin/users",
    requiredPermissions: ["USER_ADMIN_READ"],
    audience: "STAFF",
  },
];

export function visibleNavigationItems(
  context: AuthorizationContext,
): readonly ApplicationNavigationItem[] {
  return applicationNavigationItems.filter((item) => {
    if (item.permissionMatch === "ALL") {
      return item.requiredPermissions.every((permission) =>
        hasPermission(context, permission),
      );
    }
    return hasAnyPermission(context, item.requiredPermissions);
  });
}
