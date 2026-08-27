export const applicationRoleCodes = [
  "OWNER",
  "ADMIN",
  "DISPATCHER",
  "TECHNICIAN",
  "CUSTOMER",
] as const;

export type ApplicationRoleCode = (typeof applicationRoleCodes)[number];

export const permissionCodes = [
  "IDENTITY_SELF_READ",
  "IDENTITY_SELF_UPDATE",
  "USER_ADMIN_READ",
  "USER_ADMIN_MANAGE",
  "ROLE_ASSIGN",
  "SYSTEM_SETTINGS_READ",
  "SYSTEM_SETTINGS_MANAGE",
  "CATALOGUE_READ",
  "CATALOGUE_MANAGE",
  "COMMERCIAL_RULES_READ",
  "COMMERCIAL_RULES_MANAGE",
  "OPERATIONS_READ",
  "OPERATIONS_MANAGE",
  "SCHEDULE_READ",
  "SCHEDULE_MANAGE",
  "CUSTOMER_RECORDS_READ",
  "CUSTOMER_RECORDS_MANAGE",
  "FIELD_JOBS_READ",
  "FIELD_JOBS_UPDATE",
  "FINANCE_READ",
  "FINANCE_MANAGE",
  "INVOICE_ISSUE",
  "PAYMENT_RECORD",
  "COMMUNICATIONS_READ",
  "COMMUNICATIONS_MANAGE",
  "OWN_CUSTOMER_DATA_READ",
  "OWN_CUSTOMER_DATA_UPDATE",
  "AUDIT_READ",
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const canonicalRoles = [
  {
    code: "OWNER",
    labelBg: "Собственик",
    labelEn: "Owner",
    description:
      "Protected business owner with every canonical application permission.",
  },
  {
    code: "ADMIN",
    labelBg: "Администратор",
    labelEn: "Administrator",
    description:
      "Broad application administrator without protected owner-only authority.",
  },
  {
    code: "DISPATCHER",
    labelBg: "Диспечер",
    labelEn: "Dispatcher",
    description: "Operational coordination, scheduling, and customer operations.",
  },
  {
    code: "TECHNICIAN",
    labelBg: "Техник",
    labelEn: "Technician",
    description: "Assigned field work and the schedule context needed to perform it.",
  },
  {
    code: "CUSTOMER",
    labelBg: "Клиент",
    labelEn: "Customer",
    description: "Customer-safe access limited to the account's own future records.",
  },
] as const satisfies readonly {
  code: ApplicationRoleCode;
  labelBg: string;
  labelEn: string;
  description: string;
}[];

const permissionDescriptions: Record<PermissionCode, string> = {
  IDENTITY_SELF_READ: "Read the signed-in user's own application profile.",
  IDENTITY_SELF_UPDATE: "Update the signed-in user's own application profile.",
  USER_ADMIN_READ: "Read application user administration records.",
  USER_ADMIN_MANAGE: "Manage non-protected application user state.",
  ROLE_ASSIGN: "Assign allowed application roles through privileged workflows.",
  SYSTEM_SETTINGS_READ: "Read security and system configuration.",
  SYSTEM_SETTINGS_MANAGE: "Manage protected security and system configuration.",
  CATALOGUE_READ: "Read the service catalogue configuration.",
  CATALOGUE_MANAGE: "Manage the service catalogue configuration.",
  COMMERCIAL_RULES_READ: "Read commercial rules and pricing configuration.",
  COMMERCIAL_RULES_MANAGE: "Manage commercial rules and pricing configuration.",
  OPERATIONS_READ: "Read operational work records.",
  OPERATIONS_MANAGE: "Manage operational work records.",
  SCHEDULE_READ: "Read schedules relevant to the user's responsibilities.",
  SCHEDULE_MANAGE: "Manage operational schedules.",
  CUSTOMER_RECORDS_READ: "Read customer records for authorized operations.",
  CUSTOMER_RECORDS_MANAGE: "Manage customer records for authorized operations.",
  FIELD_JOBS_READ: "Read assigned or operationally authorized field jobs.",
  FIELD_JOBS_UPDATE: "Update authorized field-job execution records.",
  FINANCE_READ: "Read authorized finance and invoice records.",
  FINANCE_MANAGE: "Manage authorized draft finance records.",
  INVOICE_ISSUE: "Issue immutable invoices through authorized workflows.",
  PAYMENT_RECORD: "Record, allocate, and reverse authorized payment facts.",
  COMMUNICATIONS_READ:
    "Read authorized customer communication and document-delivery records.",
  COMMUNICATIONS_MANAGE:
    "Create controlled communication intents and customer-safe documents.",
  OWN_CUSTOMER_DATA_READ: "Read only the customer's own future business records.",
  OWN_CUSTOMER_DATA_UPDATE: "Update only the customer's own future business records.",
  AUDIT_READ: "Read authorized application audit records.",
};

export const canonicalPermissions = permissionCodes.map((code) => ({
  code,
  description: permissionDescriptions[code],
}));

export const rolePermissionMatrix = {
  OWNER: permissionCodes,
  ADMIN: [
    "IDENTITY_SELF_READ",
    "IDENTITY_SELF_UPDATE",
    "USER_ADMIN_READ",
    "USER_ADMIN_MANAGE",
    "ROLE_ASSIGN",
    "SYSTEM_SETTINGS_READ",
    "CATALOGUE_READ",
    "CATALOGUE_MANAGE",
    "COMMERCIAL_RULES_READ",
    "COMMERCIAL_RULES_MANAGE",
    "OPERATIONS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_READ",
    "SCHEDULE_MANAGE",
    "CUSTOMER_RECORDS_READ",
    "CUSTOMER_RECORDS_MANAGE",
    "FIELD_JOBS_READ",
    "FIELD_JOBS_UPDATE",
    "FINANCE_READ",
    "FINANCE_MANAGE",
    "INVOICE_ISSUE",
    "PAYMENT_RECORD",
    "COMMUNICATIONS_READ",
    "COMMUNICATIONS_MANAGE",
    "AUDIT_READ",
  ],
  DISPATCHER: [
    "IDENTITY_SELF_READ",
    "IDENTITY_SELF_UPDATE",
    "CATALOGUE_READ",
    "COMMERCIAL_RULES_READ",
    "OPERATIONS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_READ",
    "SCHEDULE_MANAGE",
    "CUSTOMER_RECORDS_READ",
    "CUSTOMER_RECORDS_MANAGE",
    "FIELD_JOBS_READ",
    "COMMUNICATIONS_READ",
    "COMMUNICATIONS_MANAGE",
  ],
  TECHNICIAN: [
    "IDENTITY_SELF_READ",
    "IDENTITY_SELF_UPDATE",
    "OPERATIONS_READ",
    "SCHEDULE_READ",
    "FIELD_JOBS_READ",
    "FIELD_JOBS_UPDATE",
  ],
  CUSTOMER: [
    "IDENTITY_SELF_READ",
    "IDENTITY_SELF_UPDATE",
    "OWN_CUSTOMER_DATA_READ",
    "OWN_CUSTOMER_DATA_UPDATE",
  ],
} as const satisfies Record<ApplicationRoleCode, readonly PermissionCode[]>;

export const customerSelfRegistrationRoles = ["CUSTOMER"] as const satisfies
  readonly ApplicationRoleCode[];

export function canAssignRole(
  actorRoles: ReadonlySet<ApplicationRoleCode>,
  targetRole: ApplicationRoleCode,
): boolean {
  if (actorRoles.has("OWNER")) {
    return true;
  }

  return (
    actorRoles.has("ADMIN") &&
    (targetRole === "DISPATCHER" ||
      targetRole === "TECHNICIAN" ||
      targetRole === "CUSTOMER")
  );
}

export function rolePermissionRows(): readonly {
  roleCode: ApplicationRoleCode;
  permissionCode: PermissionCode;
}[] {
  return applicationRoleCodes.flatMap((roleCode) =>
    rolePermissionMatrix[roleCode].map((permissionCode) => ({
      roleCode,
      permissionCode,
    })),
  );
}
