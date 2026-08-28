export const vaxDatabaseRoles = {
  migrator: "vax_migrator",
  runtime: "vax_runtime",
} as const;

export const vaxMigrationHashes = Object.freeze([
  "4f1bd455521b0546fb2aac66675347c68ecd761e88db35932f9b063eea1612d8",
  "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53",
  "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b",
  "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84",
  "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c",
  "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c",
  "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e",
  "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2",
  "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9",
  "89164bdf1a97e44ae4e8b048e63ffa1a063eb5ad185dcb9a0878f401163c81b7",
  "ea06e7cb322f7b67f65bc45b7d6da78d6d0e8551d84a25c182d40fbf05955324",
  "a82f5a727d2f80d8b467b3ab1dbb05d7ddea8985fd80299b536e6e3564c145f8",
  "4ce1cf05447457ed6ba647505c694ad16461869e15f00230cf884afa75c624fb",
  "d6bf486d01734cc61a334171dc52be76209a39a1c0cdb4ee2c5dfcfa059cdbb6",
  "d89eb981700427987f5e812ee7ff33ae7d30223776c0a617313520de5db9ccfc",
  "502a03b6d2b20954f601feb244c90e75b40cf46f0033e8cfaf9f87786080c4b1",
] as const);

export type DatabaseSecurityCategory =
  | "reference_configuration"
  | "identity_rbac"
  | "crm"
  | "request_quote"
  | "booking_scheduling"
  | "job_execution"
  | "finance"
  | "communications_documents"
  | "operational_security"
  | "audit_history"
  | "migration_system";

export type RuntimeTablePrivilege =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE";

export type DatabaseSecurityTablePolicy = Readonly<{
  category: DatabaseSecurityCategory;
  runtime: readonly RuntimeTablePrivilege[];
  immutable: boolean;
}>;

const readOnly = ["SELECT"] as const;
const readAppend = ["SELECT", "INSERT"] as const;
const readWrite = ["SELECT", "INSERT", "UPDATE"] as const;

/**
 * Reviewed policy for every VAX-owned public table. This is the authority used
 * by role provisioning checks, migration-boundary tests, and operational
 * verification. Provider-managed schemas are deliberately absent.
 *
 * Phase 3K RLS is role- and command-scoped. It does not claim customer-row
 * isolation because the current Neon HTTP repositories do not establish a
 * transaction-local, server-validated actor context on every query.
 */
export const databaseSecurityTablePolicy = {
  application_roles: {
    category: "identity_rbac",
    runtime: readOnly,
    immutable: false,
  },
  appointment_window_definitions: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  auth_audit_events: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  booking_audit_events: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  booking_items: {
    category: "booking_scheduling",
    runtime: readAppend,
    immutable: true,
  },
  booking_occupancies: {
    category: "booking_scheduling",
    runtime: readWrite,
    immutable: false,
  },
  bookings: {
    category: "booking_scheduling",
    runtime: readWrite,
    immutable: false,
  },
  business_audit_events: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  business_legal_profiles: {
    category: "finance",
    runtime: readOnly,
    immutable: false,
  },
  capability_statuses: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  cleaning_asset_reported_issues: {
    category: "crm",
    runtime: readAppend,
    immutable: true,
  },
  cleaning_asset_reported_risk_flags: {
    category: "crm",
    runtime: readAppend,
    immutable: true,
  },
  cleaning_assets: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  cleaning_item_type_measurement_modes: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  cleaning_item_types: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  cleaning_passport_entries: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  cleaning_product_categories: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  cleaning_products: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  commercial_condition_bands: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  communication_audit_events: {
    category: "audit_history",
    runtime: ["INSERT"],
    immutable: true,
  },
  communication_intents: {
    category: "communications_documents",
    runtime: readAppend,
    immutable: true,
  },
  communication_templates: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  condition_levels: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  customer_billing_profiles: {
    category: "finance",
    runtime: readOnly,
    immutable: false,
  },
  customer_communication_history_entries: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  customer_communication_preferences: {
    category: "communications_documents",
    runtime: readWrite,
    immutable: false,
  },
  customer_contacts: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  customer_identity_links: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  customers: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  delivery_attempts: {
    category: "communications_documents",
    runtime: ["INSERT"],
    immutable: true,
  },
  delivery_results: {
    category: "communications_documents",
    runtime: readAppend,
    immutable: true,
  },
  documents: {
    category: "communications_documents",
    runtime: readAppend,
    immutable: true,
  },
  duration_models: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  duration_rules: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  equipment_resources: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  fibre_materials: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  finance_audit_events: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  invoice_items: {
    category: "finance",
    runtime: readAppend,
    immutable: true,
  },
  invoice_numbering_policies: {
    category: "finance",
    runtime: ["SELECT", "UPDATE"],
    immutable: false,
  },
  invoice_policies: {
    category: "finance",
    runtime: readOnly,
    immutable: false,
  },
  invoices: {
    category: "finance",
    runtime: readWrite,
    immutable: false,
  },
  issue_handling_classifications: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  issue_types: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  job_audit_events: {
    category: "audit_history",
    runtime: readAppend,
    immutable: true,
  },
  job_item_inspection_issues: {
    category: "job_execution",
    runtime: readAppend,
    immutable: true,
  },
  job_item_inspection_risks: {
    category: "job_execution",
    runtime: readAppend,
    immutable: true,
  },
  job_item_inspections: {
    category: "job_execution",
    runtime: readAppend,
    immutable: true,
  },
  job_item_treatment_executions: {
    category: "job_execution",
    runtime: readWrite,
    immutable: false,
  },
  job_item_treatment_plan_addons: {
    category: "job_execution",
    runtime: readAppend,
    immutable: true,
  },
  job_item_treatment_plans: {
    category: "job_execution",
    runtime: readAppend,
    immutable: true,
  },
  job_items: {
    category: "job_execution",
    runtime: readWrite,
    immutable: false,
  },
  jobs: {
    category: "job_execution",
    runtime: readWrite,
    immutable: false,
  },
  material_treatment_considerations: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  measurement_modes: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  mechanical_action_levels: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  operations_teams: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  operational_rate_limits: {
    category: "operational_security",
    runtime: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    immutable: false,
  },
  parking_policies: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  payment_allocations: {
    category: "finance",
    runtime: readAppend,
    immutable: true,
  },
  payment_reversals: {
    category: "finance",
    runtime: readAppend,
    immutable: true,
  },
  payments: {
    category: "finance",
    runtime: readWrite,
    immutable: false,
  },
  permissions: {
    category: "identity_rbac",
    runtime: readOnly,
    immutable: false,
  },
  price_books: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  price_rules: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  properties: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  property_areas: {
    category: "crm",
    runtime: readWrite,
    immutable: false,
  },
  quote_acceptances: {
    category: "booking_scheduling",
    runtime: readAppend,
    immutable: true,
  },
  quote_items: {
    category: "request_quote",
    runtime: ["SELECT", "INSERT", "DELETE"],
    immutable: false,
  },
  quotes: {
    category: "request_quote",
    runtime: readWrite,
    immutable: false,
  },
  request_estimates: {
    category: "request_quote",
    runtime: readAppend,
    immutable: true,
  },
  reuse_advisory_categories: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  risk_flags: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  role_permissions: {
    category: "identity_rbac",
    runtime: readOnly,
    immutable: false,
  },
  service_addon_capabilities: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  service_addons: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  service_categories: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  service_item_capabilities: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  service_request_item_addons: {
    category: "request_quote",
    runtime: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    immutable: false,
  },
  service_request_item_issues: {
    category: "request_quote",
    runtime: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    immutable: false,
  },
  service_request_items: {
    category: "request_quote",
    runtime: readWrite,
    immutable: false,
  },
  service_requests: {
    category: "request_quote",
    runtime: readWrite,
    immutable: false,
  },
  service_treatment_levels: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  services: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  surface_constructions: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  system_metadata: {
    category: "migration_system",
    runtime: [],
    immutable: false,
  },
  team_capabilities: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  team_equipment_assignments: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  team_memberships: {
    category: "job_execution",
    runtime: readOnly,
    immutable: false,
  },
  timing_categories: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  travel_time_matrix_rules: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  travel_time_profiles: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  travel_zones: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  treatment_approaches: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  treatment_levels: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  user_profiles: {
    category: "identity_rbac",
    runtime: readWrite,
    immutable: false,
  },
  user_roles: {
    category: "identity_rbac",
    runtime: readWrite,
    immutable: false,
  },
  working_hour_policies: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
  working_hour_rules: {
    category: "reference_configuration",
    runtime: readOnly,
    immutable: false,
  },
} as const satisfies Record<string, DatabaseSecurityTablePolicy>;

export type VaxDatabaseTableName = keyof typeof databaseSecurityTablePolicy;

export const vaxDatabaseTableNames = Object.freeze(
  Object.keys(databaseSecurityTablePolicy).sort() as VaxDatabaseTableName[],
);

/**
 * Tables locked by existing transactional repositories even though ordinary
 * runtime UPDATE is forbidden. PostgreSQL requires UPDATE authority for row
 * locking. Phase 3K grants UPDATE only on one primary-key column per table and
 * pairs it with a restrictive RLS UPDATE policy whose WITH CHECK is always
 * false.
 */
export const vaxRuntimeLockPolicy = Object.freeze([
  { tableName: "appointment_window_definitions", columnName: "id" },
  { tableName: "business_legal_profiles", columnName: "id" },
  { tableName: "capability_statuses", columnName: "id" },
  {
    tableName: "cleaning_item_type_measurement_modes",
    columnName: "item_type_id",
  },
  { tableName: "cleaning_item_types", columnName: "id" },
  { tableName: "condition_levels", columnName: "id" },
  { tableName: "customer_billing_profiles", columnName: "id" },
  { tableName: "equipment_resources", columnName: "id" },
  { tableName: "fibre_materials", columnName: "id" },
  { tableName: "invoice_policies", columnName: "id" },
  { tableName: "issue_types", columnName: "id" },
  { tableName: "measurement_modes", columnName: "id" },
  { tableName: "operations_teams", columnName: "id" },
  { tableName: "quote_acceptances", columnName: "id" },
  { tableName: "quote_items", columnName: "id" },
  { tableName: "request_estimates", columnName: "id" },
  { tableName: "service_addon_capabilities", columnName: "service_id" },
  { tableName: "service_addons", columnName: "id" },
  { tableName: "service_item_capabilities", columnName: "service_id" },
  { tableName: "services", columnName: "id" },
  { tableName: "surface_constructions", columnName: "id" },
  { tableName: "team_capabilities", columnName: "id" },
  { tableName: "team_equipment_assignments", columnName: "id" },
  { tableName: "travel_time_matrix_rules", columnName: "id" },
  { tableName: "travel_time_profiles", columnName: "id" },
  { tableName: "travel_zones", columnName: "id" },
  { tableName: "working_hour_policies", columnName: "id" },
  { tableName: "working_hour_rules", columnName: "id" },
] as const satisfies readonly Readonly<{
  tableName: VaxDatabaseTableName;
  columnName: string;
}>[]);

export const vaxRuntimeLockTableNames = Object.freeze(
  vaxRuntimeLockPolicy.map((policy) => policy.tableName),
);

export const vaxTriggerFunctionNames = Object.freeze([
  "vax_communications_guard_append_only",
  "vax_communications_guard_document",
  "vax_communications_guard_intent",
  "vax_communications_guard_template",
  "vax_communications_validate_delivery_graph",
  "vax_finance_guard_append_ledger",
  "vax_finance_guard_invoice",
  "vax_finance_guard_numbering_policy",
  "vax_finance_guard_payment",
  "vax_finance_guard_versioned_config",
  "vax_finance_require_operation_actor",
  "vax_finance_validate_allocation_audit",
  "vax_finance_validate_audit_graph",
  "vax_finance_validate_invoice_audit",
  "vax_finance_validate_invoice_item",
  "vax_finance_validate_invoice_number_allocation",
  "vax_finance_validate_number_allocation",
  "vax_finance_validate_payment_audit",
  "vax_finance_validate_settlement",
] as const);

export const vaxOperationalFunctionNames = Object.freeze([
  "vax_migration_history_hashes",
] as const);
