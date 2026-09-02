import type { AuthorityDefinition } from "./types";

const definition = (
  value: AuthorityDefinition,
): AuthorityDefinition => Object.freeze(value);

export const businessAuthorityDefinitions = Object.freeze([
  definition({ key: "BRAND_IDENTITY", category: "BRAND_CONTENT", labelBg: "Марка", labelEn: "Brand identity", descriptionBg: "Одобрено публично име, включително решение за временната марка и VAX.", descriptionEn: "Approved public identity, including the temporary brand and VAX decision.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER"], allowedValueKinds: ["DECISION", "CONFIG_REFERENCE"], allowedDecisionCodes: ["APPROVE_TEMPORARY_BRAND", "FINAL_BRAND_PROVIDED", "BLOCK_PUBLICATION"], readinessValueKinds: ["CONFIG_REFERENCE"], readinessDecisionCodes: ["APPROVE_TEMPORARY_BRAND", "FINAL_BRAND_PROVIDED"], highRisk: true, productionRequired: true, blockerCode: "BRAND_NOT_APPROVED" }),
  definition({ key: "BUSINESS_CONTACT_DETAILS", category: "BRAND_CONTENT", labelBg: "Контакти", labelEn: "Business contacts", descriptionBg: "Проверени публични име, имейл, телефон, адрес и обхват.", descriptionEn: "Verified public name, email, phone, address and service-area wording.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER"], allowedValueKinds: ["BUSINESS_CONTACT"], highRisk: true, productionRequired: true, blockerCode: "BUSINESS_CONTACT_NOT_APPROVED" }),
  definition({ key: "PUBLIC_CLAIMS", category: "BRAND_CONTENT", labelBg: "Публични твърдения", labelEn: "Public claims", descriptionBg: "Публикувани и задържани твърдения с доказателствена граница.", descriptionEn: "Published and withheld claims with an evidence boundary.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "CONTENT_CLAIMS"], allowedValueKinds: ["CLAIM_DECISIONS", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "PUBLIC_CLAIMS_NOT_APPROVED" }),
  definition({ key: "SERVICE_SCOPE", category: "SERVICE_SCOPE", labelBg: "Обхват на услугите", labelEn: "Service scope", descriptionBg: "Предлагани, оценявани и отказвани услуги.", descriptionEn: "Offered, assessment-led and referred/declined services.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["SCOPE_DECISIONS", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "SERVICE_SCOPE_NOT_APPROVED" }),
  definition({ key: "ITEM_TAXONOMY_SCOPE", category: "SERVICE_SCOPE", labelBg: "Поддържани артикули", labelEn: "Supported item taxonomy", descriptionBg: "Оперативно поддържани типове артикули.", descriptionEn: "Operationally supported cleaning-item types.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["SCOPE_DECISIONS", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "ITEM_SCOPE_NOT_APPROVED" }),
  definition({ key: "MATERIAL_SPECIALIST_SCOPE", category: "SERVICE_SCOPE", labelBg: "Материали и специализиран обхват", labelEn: "Material and specialist scope", descriptionBg: "Поддръжка, оценка, препращане или отказ за деликатни материали и замърсяване.", descriptionEn: "Support, assessment, referral or decline decisions for delicate materials and contamination.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["SCOPE_DECISIONS", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "SPECIALIST_SCOPE_NOT_APPROVED" }),
  definition({ key: "TREATMENT_PRODUCT_POLICY", category: "SERVICE_SCOPE", labelBg: "Третиране и продукти", labelEn: "Treatment and product policy", descriptionBg: "Одобрени нива, употреба и доказателства за реални продукти.", descriptionEn: "Approved treatment levels, use and evidence for actual products.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "TECHNICAL"], allowedValueKinds: ["SCOPE_DECISIONS", "POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "TREATMENT_PRODUCT_NOT_APPROVED" }),
  definition({ key: "DRYING_REUSE_GUIDANCE", category: "SERVICE_SCOPE", labelBg: "Съхнене и повторна употреба", labelEn: "Drying and reuse guidance", descriptionBg: "Условни, доказуеми диапазони без абсолютни обещания.", descriptionEn: "Conditional, evidenced ranges without absolute promises.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "CONTENT_CLAIMS"], allowedValueKinds: ["DURATION_CALIBRATION", "POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "DRYING_GUIDANCE_NOT_APPROVED" }),
  definition({ key: "RESIDENTIAL_PRICE_BOOK", category: "PRICING", labelBg: "Цени за домакинства", labelEn: "Residential price book", descriptionBg: "Версионирана ценова книга, минимум, модификатори и закръгляване.", descriptionEn: "Versioned price book, minimum, modifiers and rounding.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"], allowedValueKinds: ["CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "PRICE_BOOK_NOT_APPROVED" }),
  definition({ key: "B2B_PRICE_BOOK", category: "PRICING", labelBg: "B2B цени", labelEn: "B2B price book", descriptionBg: "B2B тарифи, обем и минимална стойност.", descriptionEn: "B2B rates, volume and minimum-value policy.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"], allowedValueKinds: ["CONFIG_REFERENCE", "POLICY_SET"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "B2B_PRICE_BOOK_NOT_APPROVED" }),
  definition({ key: "TIMING_SURCHARGES", category: "PRICING", labelBg: "Добавки по време", labelEn: "Timing surcharges", descriptionBg: "Рано, вечер, уикенд и спешност.", descriptionEn: "Early, evening, weekend and urgent timing policy.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"], allowedValueKinds: ["CONFIG_REFERENCE", "POLICY_SET"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "TIMING_SURCHARGE_NOT_APPROVED" }),
  definition({ key: "VAT_TAX_STATUS", category: "VAT_TAX", labelBg: "ДДС и данъчен статус", labelEn: "VAT and tax status", descriptionBg: "Действителен статус и ефективна дата; не се извежда от процент.", descriptionEn: "Actual status and effective date; never inferred from a rate.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"], allowedValueKinds: ["DECISION"], allowedDecisionCodes: ["VAT_REGISTERED", "NOT_VAT_REGISTERED", "REVIEW_REQUIRED"], readinessDecisionCodes: ["VAT_REGISTERED", "NOT_VAT_REGISTERED"], highRisk: true, productionRequired: true, blockerCode: "VAT_STATUS_NOT_APPROVED" }),
  definition({ key: "SELLER_LEGAL_PROFILE", category: "SELLER_LEGAL", labelBg: "Профил на продавача", labelEn: "Seller legal profile", descriptionBg: "Позоваване към одобрена версия на правния профил.", descriptionEn: "Reference to an approved seller legal-profile version.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT", "LEGAL"], allowedValueKinds: ["CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "SELLER_PROFILE_MISSING" }),
  definition({ key: "DURATION_MODEL", category: "SCHEDULING", labelBg: "Модел за продължителност", labelEn: "Duration model", descriptionBg: "Планирани времена, наблюдения и буфери.", descriptionEn: "Planning durations, observations and buffers.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["CONFIG_REFERENCE", "DURATION_CALIBRATION"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "DURATION_MODEL_NOT_APPROVED" }),
  definition({ key: "WORKING_HOURS", category: "SCHEDULING", labelBg: "Работно време", labelEn: "Working hours", descriptionBg: "Оперативен избор, отделен от правно твърдение за шум.", descriptionEn: "Operating choice kept separate from legal noise claims.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["CONFIG_REFERENCE", "TIME_WINDOWS"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "WORKING_HOURS_NOT_APPROVED" }),
  definition({ key: "APPOINTMENT_WINDOWS", category: "SCHEDULING", labelBg: "Прозорци за посещение", labelEn: "Appointment windows", descriptionBg: "Клиентски етикети и точни оперативни граници.", descriptionEn: "Customer labels and exact operational boundaries.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["CONFIG_REFERENCE", "TIME_WINDOWS"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "APPOINTMENT_WINDOWS_NOT_APPROVED" }),
  definition({ key: "AVAILABILITY_POLICY", category: "SCHEDULING", labelBg: "Наличност и потвърждение", labelEn: "Availability and confirmation", descriptionBg: "Политика за моментна оферта/резервация или човешко потвърждение.", descriptionEn: "Instant quote/booking or human-confirmation policy.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["POLICY_SET"], highRisk: true, productionRequired: true, blockerCode: "AVAILABILITY_POLICY_NOT_APPROVED" }),
  definition({ key: "QUOTE_BOOKING_TERMS", category: "SCHEDULING", labelBg: "Срок и условия на оферта/резервация", labelEn: "Quote and booking terms", descriptionBg: "Валидност, приемане, анулиране и пренасрочване без измислени санкции.", descriptionEn: "Validity, acceptance, cancellation and rescheduling without invented penalties.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "LEGAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "BOOKING_TERMS_NOT_APPROVED" }),
  definition({ key: "SOFIA_SERVICE_ZONES", category: "TRAVEL", labelBg: "Зони за София", labelEn: "Sofia service zones", descriptionBg: "Проверени граници чрез райони, кодове, полигони или измерими диапазони.", descriptionEn: "Verified boundaries using districts, postcodes, polygons or measurable bands.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "TECHNICAL"], allowedValueKinds: ["CONFIG_REFERENCE", "TRAVEL_POLICY"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "SERVICE_AREA_NOT_APPROVED" }),
  definition({ key: "TRAVEL_PARKING_ROUTING", category: "TRAVEL", labelBg: "Пътуване, паркиране и маршрутизация", labelEn: "Travel, parking and routing", descriptionBg: "Обхват, буфери, такси и решение за доставчик.", descriptionEn: "Coverage, buffers, charges and provider decision.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["TRAVEL_POLICY", "PROVIDER_DECISION", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "TRAVEL_POLICY_NOT_APPROVED" }),
  definition({ key: "TEAM_CAPACITY", category: "TEAMS_EQUIPMENT", labelBg: "Екипи и капацитет", labelEn: "Teams and capacity", descriptionBg: "Реални екипи, размер, дни, умения и капацитет.", descriptionEn: "Actual teams, crew size, days, skills and capacity.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["CONFIG_REFERENCE", "POLICY_SET"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "TEAM_CAPACITY_NOT_APPROVED" }),
  definition({ key: "EQUIPMENT_INVENTORY", category: "TEAMS_EQUIPMENT", labelBg: "Оборудване", labelEn: "Equipment inventory", descriptionBg: "Проверени ресурси, състояние, способности и назначения.", descriptionEn: "Verified resources, state, capabilities and assignments.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "TECHNICAL"], allowedValueKinds: ["CONFIG_REFERENCE", "SCOPE_DECISIONS"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "EQUIPMENT_NOT_APPROVED" }),
  definition({ key: "JOB_OPERATING_POLICY", category: "SERVICE_SCOPE", labelBg: "Оперативна политика за работа", labelEn: "Job operating policy", descriptionBg: "Пристигане, оглед, безопасно спиране, промяна на обхват и предаване.", descriptionEn: "Arrival, inspection, safety stop, scope change and handover.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "JOB_POLICY_NOT_APPROVED" }),
  definition({ key: "PASSPORT_MAINTENANCE_POLICY", category: "SERVICE_SCOPE", labelBg: "Паспорт и поддръжка", labelEn: "Passport and maintenance", descriptionBg: "Видимост, препоръки според състоянието и съхранение.", descriptionEn: "Visibility, condition-led recommendations and retention.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "CONTENT_CLAIMS"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: false, productionRequired: true, blockerCode: "PASSPORT_POLICY_NOT_APPROVED" }),
  definition({ key: "AUTH_PROVIDER_RISK", category: "AUTH", labelBg: "Риск на Auth доставчика", labelEn: "Auth provider risk", descriptionBg: "Beta статус, сесии, скорошна автентикация и ограничения при ротация.", descriptionEn: "Beta status, sessions, recent authentication and rotation limits.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "TECHNICAL"], allowedValueKinds: ["PROVIDER_DECISION", "CONFIG_REFERENCE"], allowedDecisionCodes: ["ACCEPT_FOR_INITIAL_PRODUCTION", "REQUIRE_ALTERNATIVE_PROVIDER", "BLOCK_PRODUCTION"], readinessValueKinds: ["CONFIG_REFERENCE"], readinessDecisionCodes: ["ACCEPT_FOR_INITIAL_PRODUCTION"], highRisk: true, productionRequired: true, blockerCode: "AUTH_PROVIDER_RISK_UNACCEPTED" }),
  definition({ key: "AUTH_SESSION_POLICY", category: "AUTH", labelBg: "Политика за сесии", labelEn: "Auth session policy", descriptionBg: "Живот, изход, блокиране, компрометиране и възстановяване.", descriptionEn: "Lifetime, logout, suspension, compromise and recovery.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "TECHNICAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "AUTH_SESSION_POLICY_NOT_APPROVED" }),
  definition({ key: "PRIVACY_RETENTION", category: "PRIVACY_RETENTION", labelBg: "Поверителност и съхранение", labelEn: "Privacy and retention", descriptionBg: "Категорийни срокове, изключения и правен преглед без автоматично изтриване.", descriptionEn: "Category-specific periods, exceptions and legal review without automatic deletion.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "LEGAL"], allowedValueKinds: ["RETENTION_POLICY"], highRisk: true, productionRequired: true, blockerCode: "RETENTION_POLICY_PENDING" }),
  definition({ key: "SMTP_SENDER_IDENTITY", category: "EMAIL", labelBg: "SMTP и подател", labelEn: "SMTP and sender identity", descriptionBg: "Доставчик, домейн, From/reply-to, SPF, DKIM и DMARC.", descriptionEn: "Provider, domain, From/reply-to, SPF, DKIM and DMARC.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "TECHNICAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "SMTP_NOT_APPROVED" }),
  definition({ key: "MONITORING_OWNERSHIP", category: "MONITORING", labelBg: "Собственост на мониторинга", labelEn: "Monitoring ownership", descriptionBg: "Получатели, часове, сериозност и ескалация без измислена 24/7 поддръжка.", descriptionEn: "Recipients, hours, severity and escalation without invented 24/7 coverage.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "OPERATIONS", "TECHNICAL"], allowedValueKinds: ["POLICY_SET", "DECISION", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], allowedDecisionCodes: ["BASIC", "BUSINESS_HOURS", "24_7_FUTURE"], readinessDecisionCodes: ["BASIC", "BUSINESS_HOURS"], highRisk: true, productionRequired: true, blockerCode: "MONITORING_OWNER_NOT_APPROVED" }),
  definition({ key: "RECOVERY_OBJECTIVES", category: "BACKUP_RECOVERY", labelBg: "RPO/RTO и възстановяване", labelEn: "RPO/RTO and recovery", descriptionBg: "Цели, съхранение, честота и право за възстановяване; не е SLA.", descriptionEn: "Objectives, retention, frequency and restore authority; not an SLA.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER", "TECHNICAL"], allowedValueKinds: ["POLICY_SET", "DURATION_CALIBRATION", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "RECOVERY_OBJECTIVES_NOT_APPROVED" }),
  definition({ key: "INVOICE_NUMBERING", category: "FINANCE_FISCAL", labelBg: "Номерация на фактури", labelEn: "Invoice numbering", descriptionBg: "Префикс, начало, последователност, типове и дата.", descriptionEn: "Prefix, start, sequence, document types and effective date.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"], allowedValueKinds: ["CONFIG_REFERENCE", "INVOICE_NUMBERING"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "INVOICE_NUMBERING_NOT_APPROVED" }),
  definition({ key: "PAYMENT_TERMS", category: "FINANCE_FISCAL", labelBg: "Условия за плащане", labelEn: "Payment terms", descriptionBg: "Плащане при приключване, срок, предплащане и бизнес условия без измислени санкции.", descriptionEn: "Completion payment, due days, prepayment and business terms without invented penalties.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT", "LEGAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "PAYMENT_TERMS_NOT_APPROVED" }),
  definition({ key: "FINANCE_FISCAL_POLICY", category: "FINANCE_FISCAL", labelBg: "Финансова и фискална политика", labelEn: "Finance and fiscal policy", descriptionBg: "Документи, корекции, касови бележки, кредити и интеграции.", descriptionEn: "Documents, corrections, receipts, credits and integrations.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "ACCOUNTANT", "LEGAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "FINANCE_FISCAL_NOT_APPROVED" }),
  definition({ key: "PRODUCTION_DATABASE_BOOTSTRAP", category: "DATABASE", labelBg: "Production база данни", labelEn: "Production database bootstrap", descriptionBg: "Роли, миграции, права, RLS, seed и първи собственик.", descriptionEn: "Roles, migrations, grants, RLS, seeds and first owner.", evidenceClass: "SYSTEM_VERIFIED", requiredAuthorityTypes: ["TECHNICAL"], allowedValueKinds: ["POLICY_SET", "CONFIG_REFERENCE"], readinessValueKinds: ["CONFIG_REFERENCE"], highRisk: true, productionRequired: true, blockerCode: "PRODUCTION_DATABASE_NOT_VERIFIED" }),
  definition({ key: "PRODUCTION_DOMAIN_ORIGINS", category: "DOMAIN_TLS", labelBg: "Домейни и origins", labelEn: "Domains and origins", descriptionBg: "Публичен URL, app URL, Auth origin, canonical URL и TLS.", descriptionEn: "Public URL, app URL, Auth origin, canonical URL and TLS.", evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED", requiredAuthorityTypes: ["OWNER", "TECHNICAL"], allowedValueKinds: ["ENDPOINTS"], highRisk: true, productionRequired: true, blockerCode: "DOMAIN_ORIGIN_NOT_APPROVED" }),
  definition({ key: "PRODUCTION_DEPLOYMENT_AUTHORIZATION", category: "DEPLOYMENT_AUTHORIZATION", labelBg: "Разрешение за production", labelEn: "Production deployment authorization", descriptionBg: "Последно изрично GO/NO-GO решение след всички зависимости.", descriptionEn: "Final explicit GO/NO-GO decision after every dependency.", evidenceClass: "OWNER_INPUT", requiredAuthorityTypes: ["OWNER"], allowedValueKinds: ["DEPLOYMENT_AUTHORIZATION"], allowedDecisionCodes: ["GO", "NO_GO"], readinessDecisionCodes: ["GO"], highRisk: true, productionRequired: true, blockerCode: "DEPLOYMENT_NOT_AUTHORIZED" }),
] as const satisfies readonly AuthorityDefinition[]);

const definitionsByKey = new Map(
  businessAuthorityDefinitions.map((entry) => [entry.key, entry]),
);

if (definitionsByKey.size !== businessAuthorityDefinitions.length) {
  throw new Error("Business-authority keys must be unique.");
}

export function getBusinessAuthorityDefinition(
  key: string,
): AuthorityDefinition | undefined {
  return definitionsByKey.get(key);
}

export const businessAuthorityKeys = businessAuthorityDefinitions.map(
  (entry) => entry.key,
);

const readinessConfigurationSubjectTypes = Object.freeze({
  BRAND_IDENTITY: "BRAND_IDENTITY",
  PUBLIC_CLAIMS: "PUBLIC_CLAIM_CATALOG",
  SERVICE_SCOPE: "SERVICE_CATALOG",
  ITEM_TAXONOMY_SCOPE: "ITEM_TAXONOMY",
  MATERIAL_SPECIALIST_SCOPE: "MATERIAL_POLICY_CATALOG",
  TREATMENT_PRODUCT_POLICY: "TREATMENT_PRODUCT_CATALOG",
  DRYING_REUSE_GUIDANCE: "DRYING_GUIDANCE_CATALOG",
  RESIDENTIAL_PRICE_BOOK: "PRICE_BOOK",
  B2B_PRICE_BOOK: "PRICE_BOOK",
  TIMING_SURCHARGES: "TIMING_SURCHARGE_CATALOG",
  SELLER_LEGAL_PROFILE: "SELLER_LEGAL_PROFILE",
  DURATION_MODEL: "DURATION_MODEL",
  WORKING_HOURS: "WORKING_HOURS",
  APPOINTMENT_WINDOWS: "APPOINTMENT_WINDOWS",
  QUOTE_BOOKING_TERMS: "QUOTE_BOOKING_TERMS",
  SOFIA_SERVICE_ZONES: "SOFIA_SERVICE_ZONE_CATALOG",
  TRAVEL_PARKING_ROUTING: "TRAVEL_PARKING_ROUTING",
  TEAM_CAPACITY: "TEAM_CAPACITY",
  EQUIPMENT_INVENTORY: "EQUIPMENT_INVENTORY",
  JOB_OPERATING_POLICY: "JOB_OPERATING_POLICY",
  PASSPORT_MAINTENANCE_POLICY: "PASSPORT_MAINTENANCE_POLICY",
  AUTH_PROVIDER_RISK: "AUTH_PROVIDER_RISK_ASSESSMENT",
  AUTH_SESSION_POLICY: "AUTH_SESSION_POLICY",
  SMTP_SENDER_IDENTITY: "SMTP_SENDER_IDENTITY",
  MONITORING_OWNERSHIP: "MONITORING_OWNERSHIP",
  RECOVERY_OBJECTIVES: "RECOVERY_OBJECTIVES",
  INVOICE_NUMBERING: "INVOICE_NUMBERING",
  PAYMENT_TERMS: "PAYMENT_TERMS",
  FINANCE_FISCAL_POLICY: "FINANCE_FISCAL_POLICY",
  PRODUCTION_DATABASE_BOOTSTRAP: "PRODUCTION_DATABASE_BOOTSTRAP",
} as const satisfies Readonly<Record<string, string>>);

export function getReadinessConfigurationSubjectType(
  authorityKey: string,
): string | undefined {
  return readinessConfigurationSubjectTypes[
    authorityKey as keyof typeof readinessConfigurationSubjectTypes
  ];
}

for (const authority of businessAuthorityDefinitions) {
  const requiresConfigurationReference =
    authority.readinessValueKinds?.length === 1 &&
    authority.readinessValueKinds[0] === "CONFIG_REFERENCE";
  const hasConfigurationContract =
    getReadinessConfigurationSubjectType(authority.key) !== undefined;
  if (
    requiresConfigurationReference !== hasConfigurationContract ||
    (requiresConfigurationReference &&
      !authority.allowedValueKinds.includes("CONFIG_REFERENCE"))
  ) {
    throw new Error(
      `Readiness configuration contract is inconsistent for ${authority.key}.`,
    );
  }
}
