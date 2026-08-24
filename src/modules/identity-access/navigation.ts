import { hasAnyPermission, type AuthorizationContext } from "./authorization";
import type { PermissionCode } from "./policy";

export type ApplicationNavigationItem = {
  code: "ACCOUNT" | "CUSTOMER_WORKSPACE" | "OPERATIONS" | "SCHEDULE" | "FIELD_WORK" | "ADMINISTRATION";
  labelBg: string;
  labelEn: string;
  futurePath?: string;
  href?: string;
  requiredPermissions: readonly PermissionCode[];
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
    labelBg: "Моите услуги",
    labelEn: "My services",
    futurePath: "/app/requests",
    requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
    audience: "CUSTOMER",
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
  return applicationNavigationItems.filter((item) =>
    hasAnyPermission(context, item.requiredPermissions),
  );
}
