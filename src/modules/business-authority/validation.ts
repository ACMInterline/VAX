import { z } from "zod";
import {
  getBusinessAuthorityDefinition,
  getReadinessConfigurationSubjectType,
} from "./registry";
import {
  authorityEnvironmentScopes,
  authorityTypes,
  type AuthorityEnvironmentScope,
  type AuthorityType,
  type AuthorityValueKind,
} from "./types";

const codeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,95}$/);
const boundedCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/);

const sensitiveAuthorityLabelPattern =
  /(?:(?:^|[^A-Za-z])(?:password|passwd|secret)(?![A-Za-z])|\bapi[_ -]?key\b|(?:client|auth|webhook|signing)[_-]?secret\b|private[_-]?key\b|password[_-]?(?:hash|digest)\b|authorization\s*(?::|=)|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:access|refresh|session|id|auth|csrf)[_-]?token\b|\btoken["']?\s*(?::|=)|(?:session[_ -]?)?cookie["']?\s*(?::|=))/i;
const sensitiveAuthorityFieldPattern =
  /^(?:password|passwd|password[_-]?(?:hash|digest)|secret|api[_-]?key|(?:client|auth|webhook|signing)[_-]?secret|private[_-]?key|(?:(?:access|refresh|session|id|auth|csrf)[_-]?)?token|(?:session[_-]?)?cookie)$/i;
const providerIdentityFieldPattern =
  /^(?:(?:auth[_ -]?provider|provider|neon[_ -]?auth|clerk|auth0|supabase|firebase|cognito|auth)[_ -]?(?:(?:user|subject|identity)[_ -]?(?:id|identifier)|uid|sub|id)|(?:user|subject|identity|session)[_ -]?(?:id|identifier))$/i;
const providerIdentityAssignmentPattern =
  /(?:^|[^A-Za-z0-9])(?:(?:auth[_ -]?provider|provider|neon[_ -]?auth|clerk|auth0|supabase|firebase|cognito|auth)[_ -]?(?:(?:user|subject|identity)[_ -]?(?:id|identifier)|uid|sub|id)|(?:user|subject|identity|session)[_ -]?(?:id|identifier))["']?\s*(?::|=)/i;
const rawCredentialPattern =
  /(?:\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bxox[baprs]-[A-Za-z0-9-]{16,}\b|\bAIza[A-Za-z0-9_-]{20,}\b|\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b|\bAKIA[0-9A-Z]{16}\b)/;

const maximumAuthorityTextDecodeDepth = 8;

function decodeValidAsciiPercentEscapes(value: string): string {
  return value.replace(/%([0-7][0-9A-F])/gi, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function decodeAuthorityText(value: string): string {
  try {
    return decodeURIComponent(value).normalize("NFKC");
  } catch {
    // A malformed unrelated escape must not hide valid encoded ASCII labels.
    return decodeValidAsciiPercentEscapes(value).normalize("NFKC");
  }
}

function authorityTextRepresentations(value: string): Readonly<{
  representations: readonly string[];
  decodingIncomplete: boolean;
}> {
  const representations = [value.normalize("NFKC")];
  for (let depth = 0; depth < maximumAuthorityTextDecodeDepth; depth += 1) {
    const current = representations.at(-1)!;
    const decoded = decodeAuthorityText(current);
    if (decoded === current) {
      return { representations, decodingIncomplete: false };
    }
    representations.push(decoded);
  }
  const current = representations.at(-1)!;
  return {
    representations,
    decodingIncomplete: decodeAuthorityText(current) !== current,
  };
}

export function containsSensitiveAuthorityContent(value: unknown): boolean {
  if (typeof value === "string") {
    const analysis = authorityTextRepresentations(value);
    return analysis.decodingIncomplete || analysis.representations.some(
      (representation) =>
        sensitiveAuthorityLabelPattern.test(representation) ||
        providerIdentityAssignmentPattern.test(representation) ||
        rawCredentialPattern.test(representation),
    );
  }
  if (Array.isArray(value)) {
    return value.some(containsSensitiveAuthorityContent);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([field, entry]) =>
        sensitiveAuthorityFieldPattern.test(field) ||
        providerIdentityFieldPattern.test(field) ||
        containsSensitiveAuthorityContent(entry),
    );
  }
  return false;
}

function authorityTextSchema(maximumLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .refine((value) => !containsSensitiveAuthorityContent(value), {
      message: "Sensitive evidence is not allowed in authority text.",
    });
}

export const safeAuthorityTextSchema = authorityTextSchema(2_000);
const safeAuthorityLongTextSchema = authorityTextSchema(4_000);

function safeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

function safeHttpsOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      safeHttpsUrl(value) &&
      (value === parsed.origin || value === `${parsed.origin}/`)
    );
  } catch {
    return false;
  }
}

const sourceReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !containsSensitiveAuthorityContent(value))
  .refine(
    (value) =>
      !value.includes("://") || (safeHttpsUrl(value) && !value.includes("@")),
  );

const decisionValueSchema = z
  .object({
    kind: z.literal("DECISION"),
    decisionCode: codeSchema,
    detailsBg: safeAuthorityLongTextSchema.optional(),
    detailsEn: safeAuthorityLongTextSchema.optional(),
  })
  .strict();

const configurationReferenceValueSchema = z
  .object({
    kind: z.literal("CONFIG_REFERENCE"),
    subjectType: codeSchema,
    subjectCode: boundedCodeSchema,
    subjectVersion: z.number().int().positive(),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const moneyValueSchema = z
  .object({
    kind: z.literal("MONEY"),
    currency: z.literal("EUR"),
    amountMinorUnits: z.number().int().nonnegative().max(100_000_000),
    priceBasis: z.enum(["GROSS", "NET"]).optional(),
  })
  .strict();

const rateValueSchema = z
  .object({
    kind: z.literal("RATE"),
    rateCode: codeSchema,
    basisPoints: z.number().int().min(-10_000).max(100_000),
  })
  .strict();

const durationCalibrationValueSchema = z
  .object({
    kind: z.literal("DURATION_CALIBRATION"),
    subjectCode: boundedCodeSchema,
    plannedMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60),
    bufferMinutes: z
      .number()
      .int()
      .nonnegative()
      .max(12 * 60),
    observedSampleCount: z.number().int().nonnegative().max(1_000_000),
    observedMedianMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .nullable(),
    observedP90Minutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const noObservations = value.observedSampleCount === 0;
    if (
      noObservations !==
      (value.observedMedianMinutes === null &&
        value.observedP90Minutes === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observedSampleCount"],
        message: "Observation statistics must match the sample count.",
      });
    }
    if (
      value.observedMedianMinutes !== null &&
      value.observedP90Minutes !== null &&
      value.observedP90Minutes < value.observedMedianMinutes
    ) {
      context.addIssue({
        code: "custom",
        path: ["observedP90Minutes"],
        message: "The 90th percentile cannot be below the median.",
      });
    }
  });

const timeWindowSchema = z
  .object({
    code: codeSchema,
    labelBg: safeAuthorityTextSchema.max(160),
    labelEn: safeAuthorityTextSchema.max(160),
    startMinute: z.number().int().min(0).max(1_439),
    endMinute: z.number().int().min(1).max(1_440),
  })
  .strict()
  .refine((value) => value.endMinute > value.startMinute);

const timeWindowsValueSchema = z
  .object({
    kind: z.literal("TIME_WINDOWS"),
    timeZone: z.literal("Europe/Sofia"),
    windows: z.array(timeWindowSchema).min(1).max(32),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.windows.map((window) => window.code)).size ===
      value.windows.length,
    { message: "Time-window codes must be unique." },
  );

const travelPolicyValueSchema = z
  .object({
    kind: z.literal("TRAVEL_POLICY"),
    includedZoneCodes: z.array(codeSchema).max(64),
    maximumDistanceHundredthsKm: z
      .number()
      .int()
      .nonnegative()
      .max(100_000)
      .nullable(),
    maximumTravelMinutes: z
      .number()
      .int()
      .nonnegative()
      .max(24 * 60)
      .nullable(),
    minimumTravelBufferMinutes: z
      .number()
      .int()
      .nonnegative()
      .max(12 * 60),
    routingDecision: z.enum([
      "DETERMINISTIC_MATRIX_ACCEPTED",
      "LIVE_ROUTING_REQUIRED",
      "MANUAL_REVIEW",
    ]),
    parkingDecision: z.enum([
      "INCLUDED",
      "PASS_THROUGH",
      "FLAT_SURCHARGE",
      "REVIEW_REQUIRED",
    ]),
    parkingAmountMinorUnits: z
      .number()
      .int()
      .nonnegative()
      .max(10_000_000)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.parkingDecision === "FLAT_SURCHARGE") !==
      (value.parkingAmountMinorUnits !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["parkingAmountMinorUnits"],
        message: "A flat parking surcharge requires one explicit amount.",
      });
    }
  });

const retentionRuleSchema = z
  .object({
    category: z.enum([
      "AUTH_SECURITY",
      "CRM",
      "ANONYMOUS_REQUESTS",
      "QUOTES",
      "BOOKINGS",
      "JOBS",
      "PASSPORT",
      "FINANCE",
      "COMMUNICATIONS_DOCUMENTS",
    ]),
    status: z.enum(["OWNER_PROPOSED", "LEGAL_REVIEW_REQUIRED", "APPROVED"]),
    retentionDays: z.number().int().positive().max(36_500).nullable(),
    erasureException: z.enum([
      "NONE",
      "LEGAL_REVIEW_REQUIRED",
      "RETAIN_REQUIRED",
    ]),
  })
  .strict();

const retentionPolicyValueSchema = z
  .object({
    kind: z.literal("RETENTION_POLICY"),
    rules: z.array(retentionRuleSchema).min(1).max(32),
    automaticDeletionEnabled: z.literal(false),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.rules.map((rule) => rule.category)).size ===
      value.rules.length,
    { message: "Retention categories must be unique." },
  );

const invoiceNumberingValueSchema = z
  .object({
    kind: z.literal("INVOICE_NUMBERING"),
    prefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9-]{0,31}$/),
    startNumber: z.number().int().positive().max(2_147_483_647),
    paddingWidth: z.number().int().min(1).max(12),
    documentTypes: z
      .array(z.enum(["STANDARD", "PROFORMA", "CREDIT_NOTE"]))
      .min(1)
      .max(3),
  })
  .strict()
  .refine(
    (value) => new Set(value.documentTypes).size === value.documentTypes.length,
    { message: "Invoice document types must be unique." },
  );

const endpointsValueSchema = z
  .object({
    kind: z.literal("ENDPOINTS"),
    publicWebsiteUrl: z.string().url().refine(safeHttpsOrigin),
    applicationUrl: z.string().url().refine(safeHttpsOrigin),
    authTrustedOrigin: z.string().url().refine(safeHttpsOrigin),
    canonicalUrl: z.string().url().refine(safeHttpsOrigin),
  })
  .strict();

const providerDecisionValueSchema = z
  .object({
    kind: z.literal("PROVIDER_DECISION"),
    decisionCode: codeSchema,
    providerName: z.string().trim().min(1).max(160).optional(),
    conditions: z.array(safeAuthorityTextSchema.max(500)).max(32),
  })
  .strict();

const scopeDecisionSchema = z
  .object({
    code: boundedCodeSchema,
    decision: z.enum([
      "OFFERED",
      "ASSESSMENT_ONLY",
      "STAGING_ONLY",
      "PRODUCTION_READY",
      "SUPPORTED",
      "ASSESSMENT_REQUIRED",
      "REFER",
      "DECLINE",
    ]),
  })
  .strict();

const scopeDecisionsValueSchema = z
  .object({
    kind: z.literal("SCOPE_DECISIONS"),
    entries: z.array(scopeDecisionSchema).min(1).max(500),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.code)).size ===
      value.entries.length,
    { message: "Scope codes must be unique." },
  );

const claimDecisionSchema = z
  .object({
    claimId: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]{1,127}$/),
    decision: z.enum(["PUBLISHED", "WITHHELD", "PROPOSED"]),
    evidenceReference: sourceReferenceSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.decision !== "PUBLISHED" || value.evidenceReference !== null,
    { message: "Published claims require evidence." },
  );

const claimDecisionsValueSchema = z
  .object({
    kind: z.literal("CLAIM_DECISIONS"),
    entries: z.array(claimDecisionSchema).min(1).max(500),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.claimId)).size ===
      value.entries.length,
    { message: "Claim identifiers must be unique." },
  );

const policyEntrySchema = z
  .object({
    code: codeSchema,
    decision: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,95}$/),
    numericValue: z.number().int().min(0).max(1_000_000_000).nullable(),
    unit: z
      .enum(["MINUTES", "DAYS", "COUNT", "MINOR_UNITS", "BASIS_POINTS"])
      .nullable(),
  })
  .strict()
  .refine((value) => (value.numericValue === null) === (value.unit === null), {
    message: "A policy number and its unit must be supplied together.",
  });

const policySetValueSchema = z
  .object({
    kind: z.literal("POLICY_SET"),
    entries: z.array(policyEntrySchema).min(1).max(256),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.code)).size ===
      value.entries.length,
    { message: "Policy codes must be unique." },
  );

const businessContactValueSchema = z
  .object({
    kind: z.literal("BUSINESS_CONTACT"),
    businessName: z.string().trim().min(1).max(255),
    email: z.email().max(320).nullable(),
    phone: z.string().trim().min(1).max(40).nullable(),
    address: z.string().trim().min(1).max(1_000).nullable(),
    serviceAreaBg: safeAuthorityTextSchema.max(1_000),
    serviceAreaEn: safeAuthorityTextSchema.max(1_000),
  })
  .strict();

const deploymentAuthorizationValueSchema = z
  .object({
    kind: z.literal("DEPLOYMENT_AUTHORIZATION"),
    decisionCode: z.enum(["GO", "NO_GO"]),
    releaseCommitSha: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
    targetReference: boundedCodeSchema,
    changeWindowStart: z.iso.datetime({ offset: true }),
    changeWindowEnd: z.iso.datetime({ offset: true }),
    dependencyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine(
    (value) =>
      new Date(value.changeWindowEnd) > new Date(value.changeWindowStart),
    {
      path: ["changeWindowEnd"],
      message: "The production change window must end after it starts.",
    },
  );

export const authorityValueSchema = z
  .discriminatedUnion("kind", [
    decisionValueSchema,
    configurationReferenceValueSchema,
    moneyValueSchema,
    rateValueSchema,
    durationCalibrationValueSchema,
    timeWindowsValueSchema,
    travelPolicyValueSchema,
    retentionPolicyValueSchema,
    invoiceNumberingValueSchema,
    endpointsValueSchema,
    providerDecisionValueSchema,
    scopeDecisionsValueSchema,
    claimDecisionsValueSchema,
    policySetValueSchema,
    businessContactValueSchema,
    deploymentAuthorizationValueSchema,
  ])
  .superRefine((value, context) => {
    if (containsSensitiveAuthorityContent(value)) {
      context.addIssue({
        code: "custom",
        message: "Sensitive content is not allowed in an authority value.",
      });
    }
  });

export type AuthorityValue = z.infer<typeof authorityValueSchema>;

type PolicyRequirement = Readonly<{
  code: string;
  allowedDecisions: readonly string[];
  numericUnit?: "MINUTES" | "DAYS";
  minimumNumericValue?: number;
}>;

const policyRequirements: Readonly<
  Partial<Record<string, readonly PolicyRequirement[]>>
> = {
  AVAILABILITY_POLICY: [
    { code: "QUOTE_MODE", allowedDecisions: ["ASSESSMENT_REQUIRED"] },
    {
      code: "BOOKING_MODE",
      allowedDecisions: ["STAFF_CONFIRMATION_REQUIRED"],
    },
  ],
  QUOTE_BOOKING_TERMS: [
    {
      code: "QUOTE_VALIDITY",
      allowedDecisions: ["DEFINED"],
      numericUnit: "DAYS",
      minimumNumericValue: 1,
    },
    { code: "BOOKING_CONFIRMATION", allowedDecisions: ["DEFINED"] },
    { code: "CANCELLATION", allowedDecisions: ["DEFINED"] },
    { code: "RESCHEDULING", allowedDecisions: ["DEFINED"] },
  ],
  JOB_OPERATING_POLICY: [
    { code: "ARRIVAL", allowedDecisions: ["DEFINED"] },
    { code: "INSPECTION", allowedDecisions: ["REQUIRED"] },
    { code: "SAFETY_STOP", allowedDecisions: ["REQUIRED"] },
    { code: "REFER_DECLINE", allowedDecisions: ["DEFINED"] },
    {
      code: "SCOPE_CHANGE",
      allowedDecisions: ["STAFF_APPROVAL_REQUIRED"],
    },
    { code: "COMPLETION", allowedDecisions: ["DEFINED"] },
    { code: "CUSTOMER_HANDOVER", allowedDecisions: ["REQUIRED"] },
  ],
  PASSPORT_MAINTENANCE_POLICY: [
    { code: "CUSTOMER_VISIBILITY", allowedDecisions: ["DEFINED"] },
    { code: "MAINTENANCE_BASIS", allowedDecisions: ["CONDITION_BASED"] },
    { code: "RETENTION", allowedDecisions: ["DEFINED"] },
  ],
  AUTH_SESSION_POLICY: [
    {
      code: "MAXIMUM_LIFETIME",
      allowedDecisions: ["DEFINED"],
      numericUnit: "MINUTES",
      minimumNumericValue: 1,
    },
    { code: "LOGOUT", allowedDecisions: ["DEFINED"] },
    { code: "SUSPENDED_USER", allowedDecisions: ["FAIL_CLOSED"] },
    { code: "COMPROMISED_ACCOUNT", allowedDecisions: ["DEFINED"] },
    { code: "EMERGENCY_RECOVERY", allowedDecisions: ["DEFINED"] },
  ],
  SMTP_SENDER_IDENTITY: [
    { code: "PROVIDER", allowedDecisions: ["SELECTED"] },
    { code: "FROM_IDENTITY", allowedDecisions: ["VERIFIED"] },
    { code: "REPLY_TO_IDENTITY", allowedDecisions: ["VERIFIED"] },
    { code: "SPF", allowedDecisions: ["VERIFIED"] },
    { code: "DKIM", allowedDecisions: ["VERIFIED"] },
    { code: "DMARC", allowedDecisions: ["VERIFIED"] },
  ],
  MONITORING_OWNERSHIP: [
    { code: "ALERT_RECIPIENTS", allowedDecisions: ["DEFINED"] },
    {
      code: "COVERAGE_LEVEL",
      allowedDecisions: ["BASIC", "BUSINESS_HOURS"],
    },
    { code: "RESPONSE_HOURS", allowedDecisions: ["DEFINED"] },
    { code: "SEVERITY", allowedDecisions: ["DEFINED"] },
    { code: "ESCALATION", allowedDecisions: ["DEFINED"] },
  ],
  RECOVERY_OBJECTIVES: [
    {
      code: "RPO",
      allowedDecisions: ["DEFINED"],
      numericUnit: "MINUTES",
      minimumNumericValue: 1,
    },
    {
      code: "RTO",
      allowedDecisions: ["DEFINED"],
      numericUnit: "MINUTES",
      minimumNumericValue: 1,
    },
    {
      code: "BACKUP_FREQUENCY",
      allowedDecisions: ["DEFINED"],
      numericUnit: "MINUTES",
      minimumNumericValue: 1,
    },
    {
      code: "BACKUP_RETENTION",
      allowedDecisions: ["DEFINED"],
      numericUnit: "DAYS",
      minimumNumericValue: 1,
    },
    { code: "RESTORE_AUTHORITY", allowedDecisions: ["DEFINED"] },
  ],
  PAYMENT_TERMS: [
    { code: "PAYMENT_MODE", allowedDecisions: ["DEFINED"] },
    {
      code: "DUE_DAYS",
      allowedDecisions: ["DEFINED"],
      numericUnit: "DAYS",
      minimumNumericValue: 0,
    },
    {
      code: "PREPAYMENT",
      allowedDecisions: ["DEFINED", "NOT_APPLICABLE"],
    },
    { code: "BUSINESS_TERMS", allowedDecisions: ["DEFINED"] },
  ],
  FINANCE_FISCAL_POLICY: [
    { code: "DOCUMENT_TYPES", allowedDecisions: ["DEFINED"] },
    { code: "CORRECTION_POLICY", allowedDecisions: ["DEFINED"] },
    { code: "FISCAL_DECISION", allowedDecisions: ["DEFINED"] },
    {
      code: "ACCOUNTING_INTEGRATION",
      allowedDecisions: ["DEFINED", "NOT_REQUIRED"],
    },
    { code: "REFUND_POLICY", allowedDecisions: ["DEFINED"] },
  ],
  PRODUCTION_DATABASE_BOOTSTRAP: [
    { code: "BRANCH_PROTECTION", allowedDecisions: ["VERIFIED"] },
    { code: "ROLE_SEPARATION", allowedDecisions: ["VERIFIED"] },
    { code: "MIGRATIONS", allowedDecisions: ["VERIFIED"] },
    { code: "GRANTS", allowedDecisions: ["VERIFIED"] },
    { code: "RLS", allowedDecisions: ["VERIFIED"] },
    { code: "SEEDS", allowedDecisions: ["VERIFIED"] },
    { code: "FIRST_OWNER", allowedDecisions: ["VERIFIED"] },
    { code: "RECOVERY_EVIDENCE", allowedDecisions: ["VERIFIED"] },
  ],
};

export function policySetValueIsSemanticallyValid(
  authorityKey: string,
  value: Extract<AuthorityValue, { kind: "POLICY_SET" }>,
): boolean {
  const requirements = policyRequirements[authorityKey];
  if (!requirements || value.entries.length !== requirements.length) {
    return false;
  }
  return requirements.every((requirement) => {
    const entry = value.entries.find(
      (candidate) => candidate.code === requirement.code,
    );
    if (!entry || !requirement.allowedDecisions.includes(entry.decision)) {
      return false;
    }
    if (requirement.numericUnit) {
      return (
        entry.unit === requirement.numericUnit &&
        entry.numericValue !== null &&
        entry.numericValue >= (requirement.minimumNumericValue ?? 0)
      );
    }
    return entry.numericValue === null && entry.unit === null;
  });
}

export const authorityProposalSchema = z
  .object({
    authorityKey: codeSchema,
    environmentScope: z.enum(authorityEnvironmentScopes),
    value: authorityValueSchema,
    sourceReference: sourceReferenceSchema.nullable(),
    safeEvidenceSummary: safeAuthorityTextSchema.max(2_000).nullable(),
    internalNotes: safeAuthorityLongTextSchema.nullable(),
    effectiveFrom: z.date(),
    effectiveUntil: z.date().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const definition = getBusinessAuthorityDefinition(value.authorityKey);
    if (!definition) {
      context.addIssue({
        code: "custom",
        path: ["authorityKey"],
        message: "Unknown authority key.",
      });
      return;
    }
    if (!definition.allowedValueKinds.includes(value.value.kind)) {
      context.addIssue({
        code: "custom",
        path: ["value", "kind"],
        message: "Value kind is not allowed for this authority.",
      });
    }
    if (value.value.kind === "CONFIG_REFERENCE") {
      const expectedSubjectType = getReadinessConfigurationSubjectType(
        value.authorityKey,
      );
      if (
        !expectedSubjectType ||
        value.value.subjectType !== expectedSubjectType
      ) {
        context.addIssue({
          code: "custom",
          path: ["value", "subjectType"],
          message:
            "Configuration reference does not match the governed subject type.",
        });
      }
    }
    if (
      value.value.kind === "POLICY_SET" &&
      !policySetValueIsSemanticallyValid(value.authorityKey, value.value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value", "entries"],
        message: "Policy entries do not match the governed semantic contract.",
      });
    }
    if (
      value.value.kind === "RETENTION_POLICY" &&
      value.value.rules.some(
        (rule) =>
          rule.status === "APPROVED" &&
          rule.erasureException === "LEGAL_REVIEW_REQUIRED",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["value", "rules"],
        message: "Approved retention cannot retain unresolved legal review.",
      });
    }
    const decisionCode =
      value.value.kind === "DECISION" ||
      value.value.kind === "PROVIDER_DECISION" ||
      value.value.kind === "DEPLOYMENT_AUTHORIZATION"
        ? value.value.decisionCode
        : undefined;
    if (
      decisionCode &&
      definition.allowedDecisionCodes &&
      !definition.allowedDecisionCodes.includes(decisionCode)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value", "decisionCode"],
        message: "Decision is not allowed for this authority.",
      });
    }
    if (
      definition.evidenceClass === "EXTERNAL_EVIDENCE_REQUIRED" &&
      value.sourceReference === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceReference"],
        message: "External evidence requires a safe reference.",
      });
    }
    if (
      value.authorityKey === "PRODUCTION_DEPLOYMENT_AUTHORIZATION" &&
      value.environmentScope !== "PRODUCTION"
    ) {
      context.addIssue({
        code: "custom",
        path: ["environmentScope"],
        message:
          "Production deployment authorization is production-scoped only.",
      });
    }
    if (value.effectiveUntil && value.effectiveUntil <= value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "Effective end must be later than the start.",
      });
    }
  });

export type AuthorityProposalInput = z.infer<typeof authorityProposalSchema>;

export const authorityDecisionSchema = z
  .object({
    recordId: z.uuid(),
    expectedAuthorityVersion: z.number().int().positive(),
    expectedRecordVersion: z.number().int().nonnegative(),
    expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    action: z.enum(["SUBMIT_FOR_REVIEW", "APPROVE", "REJECT"]),
    decisionAuthorityType: z.enum(authorityTypes).nullable(),
    evidenceReference: sourceReferenceSchema.nullable(),
    safeEvidenceSummary: safeAuthorityTextSchema.max(2_000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "APPROVE" && value.decisionAuthorityType === null) {
      context.addIssue({
        code: "custom",
        path: ["decisionAuthorityType"],
        message: "Approval authority is required.",
      });
    }
    if (value.action !== "APPROVE" && value.decisionAuthorityType !== null) {
      context.addIssue({
        code: "custom",
        path: ["decisionAuthorityType"],
        message: "Only approval records an authority type.",
      });
    }
  });

export type AuthorityDecisionInput = z.infer<typeof authorityDecisionSchema>;

export function parseAuthorityValueJson(value: string): unknown {
  if (Buffer.byteLength(value, "utf8") > 16_384) {
    throw new Error("Authority value is too large.");
  }
  return JSON.parse(value) as unknown;
}

export function authorityValueKind(value: unknown): AuthorityValueKind | null {
  const parsed = authorityValueSchema.safeParse(value);
  return parsed.success ? parsed.data.kind : null;
}

export function expectedApprovedStatus(
  environmentScope: AuthorityEnvironmentScope,
): "APPROVED_FOR_STAGING" | "APPROVED_FOR_PRODUCTION" | null {
  if (environmentScope === "STAGING") return "APPROVED_FOR_STAGING";
  if (environmentScope === "PRODUCTION") return "APPROVED_FOR_PRODUCTION";
  return null;
}

export function uniqueAuthorityTypes(
  values: readonly AuthorityType[],
): readonly AuthorityType[] {
  return [...new Set(values)];
}
