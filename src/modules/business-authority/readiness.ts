import { createHash } from "node:crypto";
import {
  businessAuthorityDefinitions,
  getReadinessConfigurationSubjectType,
} from "./registry";
import {
  authorityValueSchema,
  expectedApprovedStatus,
  policySetValueIsSemanticallyValid,
  type AuthorityValue,
} from "./validation";
import type {
  AuthorityCategory,
  AuthorityDefinition,
  AuthorityEnvironmentScope,
  BusinessAuthorityEvent,
  BusinessAuthorityRecord,
  ReadinessMatrixStatus,
} from "./types";

export type ConfigurationReferenceSnapshot = Readonly<{
  resolverId: string;
  resolverVersion: string;
  subjectType: string;
  subjectCode: string;
  subjectVersion: number;
  contentSha256: string;
  environmentScope: "STAGING" | "PRODUCTION";
  status: "ACTIVE" | "APPROVED";
  provisional: boolean;
  unresolvedManualReview: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  supersededAt: Date | null;
  supersededByReference: string | null;
}>;

export type ReleaseTargetSnapshot = Readonly<{
  releaseCommitSha: string;
  targetReference: string;
}>;

export type ReadinessItem = Readonly<{
  authorityKey: string;
  category: AuthorityCategory;
  labelBg: string;
  labelEn: string;
  approved: boolean;
  version: number | null;
  effectiveFrom: Date | null;
  sourceReference: string | null;
  blockerCode: string | null;
  matrixStatus: ReadinessMatrixStatus;
}>;

export type ProductionAuthorizationPackage = Readonly<{
  environmentScope: AuthorityEnvironmentScope;
  generatedAt: Date;
  ready: boolean;
  approvedItems: readonly ReadinessItem[];
  pendingItems: readonly ReadinessItem[];
  blockers: readonly string[];
  categories: readonly Readonly<{
    category: AuthorityCategory;
    status: "PASS" | "BLOCKED";
    blockerCount: number;
  }>[];
}>;

type ReadinessOptions = Readonly<{
  environmentScope?: "STAGING" | "PRODUCTION";
  now?: Date;
  approvalEvents?: readonly BusinessAuthorityEvent[];
  configurationReferences?: readonly ConfigurationReferenceSnapshot[];
}>;

const retentionCategories = new Set([
  "AUTH_SECURITY",
  "CRM",
  "ANONYMOUS_REQUESTS",
  "QUOTES",
  "BOOKINGS",
  "JOBS",
  "PASSPORT",
  "FINANCE",
  "COMMUNICATIONS_DOCUMENTS",
]);

function missingMatrixStatus(
  definition: AuthorityDefinition,
  technicalFailure: boolean,
): ReadinessMatrixStatus {
  if (definition.key === "PRODUCTION_DEPLOYMENT_AUTHORIZATION") {
    return "NOT_AUTHORIZED";
  }
  if (definition.key === "AUTH_PROVIDER_RISK") return "PROVIDER_LIMITATION";
  if (technicalFailure || definition.evidenceClass === "SYSTEM_VERIFIED") {
    return "TECHNICAL_BLOCKER";
  }
  if (definition.requiredAuthorityTypes.includes("LEGAL")) {
    return "LEGAL_REVIEW_REQUIRED";
  }
  if (definition.requiredAuthorityTypes.includes("ACCOUNTANT")) {
    return "ACCOUNTANT_APPROVAL_REQUIRED";
  }
  return "OWNER_APPROVAL_REQUIRED";
}

function approvedByEveryAuthority(
  record: BusinessAuthorityRecord,
  events: readonly BusinessAuthorityEvent[],
): boolean {
  const approvals = new Set(
    events
      .filter(
        (event) =>
          event.authorityRecordId === record.id &&
          (event.eventType === "AUTHORITY_APPROVAL_RECORDED" ||
            event.eventType === "AUTHORITY_APPROVED") &&
          event.decisionAuthorityType !== null,
      )
      .map((event) => event.decisionAuthorityType),
  );
  return record.requiredAuthorityTypes.every((authorityType) =>
    approvals.has(authorityType),
  );
}

function matchedConfigurationReference(
  authorityKey: string,
  value: Extract<AuthorityValue, { kind: "CONFIG_REFERENCE" }>,
  environmentScope: "STAGING" | "PRODUCTION",
  now: Date,
  references: readonly ConfigurationReferenceSnapshot[],
): ConfigurationReferenceSnapshot | null {
  const expectedSubjectType =
    getReadinessConfigurationSubjectType(authorityKey);
  if (!expectedSubjectType || value.subjectType !== expectedSubjectType) {
    return null;
  }
  const eligibleSnapshots = references.filter(
    (reference) =>
      reference.subjectType === value.subjectType &&
      reference.subjectCode === value.subjectCode &&
      reference.environmentScope === environmentScope &&
      (reference.status === "ACTIVE" || reference.status === "APPROVED") &&
      !reference.provisional &&
      !reference.unresolvedManualReview &&
      reference.resolverId.trim().length > 0 &&
      reference.resolverVersion.trim().length > 0 &&
      reference.supersededAt === null &&
      reference.supersededByReference === null &&
      reference.effectiveFrom <= now &&
      (reference.effectiveUntil === null || reference.effectiveUntil > now),
  );
  if (eligibleSnapshots.length !== 1) return null;
  const match = eligibleSnapshots[0]!;
  return match.subjectVersion === value.subjectVersion &&
    match.contentSha256 === value.contentSha256
    ? match
    : null;
}

function policySetReady(
  authorityKey: string,
  value: Extract<AuthorityValue, { kind: "POLICY_SET" }>,
): boolean {
  return policySetValueIsSemanticallyValid(authorityKey, value);
}

function windowsDoNotOverlap(
  value: Extract<AuthorityValue, { kind: "TIME_WINDOWS" }>,
): boolean {
  const windows = [...value.windows].sort(
    (left, right) => left.startMinute - right.startMinute,
  );
  return windows.every(
    (window, index) =>
      index === 0 || windows[index - 1]!.endMinute <= window.startMinute,
  );
}

function valueIsOperationallyComplete(
  definition: AuthorityDefinition,
  value: AuthorityValue,
  environmentScope: "STAGING" | "PRODUCTION",
  now: Date,
  references: readonly ConfigurationReferenceSnapshot[],
): boolean {
  if (!definition.allowedValueKinds.includes(value.kind)) return false;
  if (
    definition.readinessValueKinds &&
    !definition.readinessValueKinds.includes(value.kind)
  ) {
    return false;
  }

  if (
    value.kind === "DECISION" ||
    value.kind === "PROVIDER_DECISION" ||
    value.kind === "DEPLOYMENT_AUTHORIZATION"
  ) {
    if (
      definition.allowedDecisionCodes &&
      !definition.allowedDecisionCodes.includes(value.decisionCode)
    ) {
      return false;
    }
    if (
      definition.readinessDecisionCodes &&
      !definition.readinessDecisionCodes.includes(value.decisionCode)
    ) {
      return false;
    }
  }

  if (value.kind === "CONFIG_REFERENCE") {
    return (
      matchedConfigurationReference(
        definition.key,
        value,
        environmentScope,
        now,
        references,
      ) !== null
    );
  }
  if (value.kind === "POLICY_SET") {
    return policySetReady(definition.key, value);
  }
  if (value.kind === "RETENTION_POLICY") {
    return (
      value.rules.length === retentionCategories.size &&
      value.rules.every(
        (rule) =>
          retentionCategories.has(rule.category) &&
          rule.status === "APPROVED" &&
          rule.retentionDays !== null &&
          rule.erasureException !== "LEGAL_REVIEW_REQUIRED",
      )
    );
  }
  if (value.kind === "SCOPE_DECISIONS") {
    return value.entries.every((entry) => entry.decision !== "STAGING_ONLY");
  }
  if (value.kind === "CLAIM_DECISIONS") {
    return value.entries.every((entry) => entry.decision !== "PROPOSED");
  }
  if (value.kind === "TRAVEL_POLICY") {
    return (
      value.includedZoneCodes.length > 0 &&
      value.routingDecision === "DETERMINISTIC_MATRIX_ACCEPTED" &&
      value.parkingDecision !== "REVIEW_REQUIRED"
    );
  }
  if (value.kind === "TIME_WINDOWS") return windowsDoNotOverlap(value);
  if (value.kind === "BUSINESS_CONTACT") {
    return (
      value.email !== null && value.phone !== null && value.address !== null
    );
  }
  return true;
}

type RecordSelection = Readonly<{
  record: BusinessAuthorityRecord | null;
  configurationReference: ConfigurationReferenceSnapshot | null;
  technicalFailure: boolean;
}>;

function currentApprovedRecord(
  records: readonly BusinessAuthorityRecord[],
  events: readonly BusinessAuthorityEvent[],
  definition: AuthorityDefinition,
  environmentScope: "STAGING" | "PRODUCTION",
  now: Date,
  references: readonly ConfigurationReferenceSnapshot[],
): RecordSelection {
  const expectedStatus = expectedApprovedStatus(environmentScope);
  const structuralCandidates = records.filter(
    (record) =>
      record.authorityKey === definition.key &&
      record.category === definition.category &&
      record.environmentScope === environmentScope &&
      /^[a-f0-9]{64}$/.test(record.contentHash) &&
      (record.status === expectedStatus ||
        (record.status === "SUPERSEDED" &&
          record.supersededAt !== null &&
          record.supersededAt > now)) &&
      (record.status === "SUPERSEDED" || record.supersededById === null) &&
      record.effectiveFrom <= now &&
      (record.effectiveUntil === null || record.effectiveUntil > now) &&
      record.evidenceClass === definition.evidenceClass &&
      record.requiredAuthorityTypes.length ===
        definition.requiredAuthorityTypes.length &&
      definition.requiredAuthorityTypes.every((authorityType) =>
        record.requiredAuthorityTypes.includes(authorityType),
      ),
  );

  const candidates = structuralCandidates.filter((record) => {
    const parsed = authorityValueSchema.safeParse(record.value);
    return (
      parsed.success &&
      valueIsOperationallyComplete(
        definition,
        parsed.data,
        environmentScope,
        now,
        references,
      ) &&
      (definition.evidenceClass !== "EXTERNAL_EVIDENCE_REQUIRED" ||
        record.sourceReference !== null) &&
      approvedByEveryAuthority(record, events)
    );
  });

  if (candidates.length !== 1) {
    return {
      record: null,
      configurationReference: null,
      technicalFailure:
        structuralCandidates.length > 0 && candidates.length !== 1,
    };
  }
  const record = candidates[0]!;
  const parsed = authorityValueSchema.safeParse(record.value);
  const configurationReference =
    parsed.success && parsed.data.kind === "CONFIG_REFERENCE"
      ? matchedConfigurationReference(
          definition.key,
          parsed.data,
          environmentScope,
          now,
          references,
        )
      : null;
  return { record, configurationReference, technicalFailure: false };
}

function itemForSelection(
  definition: AuthorityDefinition,
  selection: RecordSelection,
): ReadinessItem {
  if (!selection.record) {
    return {
      authorityKey: definition.key,
      category: definition.category,
      labelBg: definition.labelBg,
      labelEn: definition.labelEn,
      approved: false,
      version: null,
      effectiveFrom: null,
      sourceReference: null,
      blockerCode: definition.blockerCode,
      matrixStatus: missingMatrixStatus(
        definition,
        selection.technicalFailure,
      ),
    };
  }
  return {
    authorityKey: definition.key,
    category: definition.category,
    labelBg: definition.labelBg,
    labelEn: definition.labelEn,
    approved: true,
    version: selection.record.version,
    effectiveFrom: selection.record.effectiveFrom,
    sourceReference: selection.record.sourceReference,
    blockerCode: null,
    matrixStatus: "PASS",
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

export function createProductionDependencyFingerprint(
  records: readonly BusinessAuthorityRecord[],
  configurationReferences: readonly ConfigurationReferenceSnapshot[] = [],
): string {
  const authorityRecords = records
    .map((record) => ({
      authorityKey: record.authorityKey,
      authorityRecordId: record.id,
      authorityVersion: record.version,
      recordVersion: record.recordVersion,
      contentHash: record.contentHash,
      environmentScope: record.environmentScope,
      status: record.status,
      evidenceClass: record.evidenceClass,
      requiredAuthorityTypes: [...record.requiredAuthorityTypes].sort(),
      approvedAt: record.approvedAt?.toISOString() ?? null,
      effectiveFrom: record.effectiveFrom.toISOString(),
      effectiveUntil: record.effectiveUntil?.toISOString() ?? null,
      supersededAt: record.supersededAt?.toISOString() ?? null,
      supersededById: record.supersededById,
      value: canonicalValue(record.value),
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  const referenceSnapshots = configurationReferences
    .map((reference) => ({
      resolverId: reference.resolverId,
      resolverVersion: reference.resolverVersion,
      subjectType: reference.subjectType,
      subjectCode: reference.subjectCode,
      subjectVersion: reference.subjectVersion,
      contentSha256: reference.contentSha256,
      environmentScope: reference.environmentScope,
      status: reference.status,
      provisional: reference.provisional,
      unresolvedManualReview: reference.unresolvedManualReview,
      effectiveFrom: reference.effectiveFrom.toISOString(),
      effectiveUntil: reference.effectiveUntil?.toISOString() ?? null,
      supersededAt: reference.supersededAt?.toISOString() ?? null,
      supersededByReference: reference.supersededByReference,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  const payload = { authorityRecords, referenceSnapshots };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export type ProductionDependencySnapshot = Readonly<{
  ready: boolean;
  fingerprint: string | null;
  items: readonly ReadinessItem[];
  selectedRecords: readonly BusinessAuthorityRecord[];
  selectedConfigurationReferences: readonly ConfigurationReferenceSnapshot[];
}>;

export function evaluateProductionDependencies(
  records: readonly BusinessAuthorityRecord[],
  options: ReadinessOptions = {},
): ProductionDependencySnapshot {
  const environmentScope = options.environmentScope ?? "PRODUCTION";
  const now = options.now ?? new Date();
  const events = options.approvalEvents ?? [];
  const references = options.configurationReferences ?? [];
  const definitions = businessAuthorityDefinitions.filter(
    (definition) =>
      definition.productionRequired &&
      definition.key !== "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
  );
  const selectedRecords: BusinessAuthorityRecord[] = [];
  const selectedConfigurationReferences: ConfigurationReferenceSnapshot[] = [];
  const items = definitions.map((definition) => {
    const selection = currentApprovedRecord(
      records,
      events,
      definition,
      environmentScope,
      now,
      references,
    );
    if (selection.record) selectedRecords.push(selection.record);
    if (selection.configurationReference) {
      selectedConfigurationReferences.push(selection.configurationReference);
    }
    return itemForSelection(definition, selection);
  });
  const ready = items.every((item) => item.approved);
  return {
    ready,
    fingerprint: ready
      ? createProductionDependencyFingerprint(
          selectedRecords,
          selectedConfigurationReferences,
        )
      : null,
    items,
    selectedRecords,
    selectedConfigurationReferences,
  };
}

export function deploymentAuthorizationMatchesSnapshot(
  value: unknown,
  dependencyFingerprint: string | null,
  releaseTarget: ReleaseTargetSnapshot | undefined,
  now: Date,
): boolean {
  const parsed = authorityValueSchema.safeParse(value);
  return Boolean(
    parsed.success &&
      parsed.data.kind === "DEPLOYMENT_AUTHORIZATION" &&
      parsed.data.decisionCode === "GO" &&
      dependencyFingerprint !== null &&
      parsed.data.dependencyFingerprint === dependencyFingerprint &&
      releaseTarget &&
      parsed.data.releaseCommitSha === releaseTarget.releaseCommitSha &&
      parsed.data.targetReference === releaseTarget.targetReference &&
      new Date(parsed.data.changeWindowStart) <= now &&
      new Date(parsed.data.changeWindowEnd) > now,
  );
}

function deploymentSelection(
  records: readonly BusinessAuthorityRecord[],
  events: readonly BusinessAuthorityEvent[],
  environmentScope: "STAGING" | "PRODUCTION",
  now: Date,
  references: readonly ConfigurationReferenceSnapshot[],
  dependencyFingerprint: string | null,
  releaseTarget: ReleaseTargetSnapshot | undefined,
): RecordSelection {
  const definition = businessAuthorityDefinitions.find(
    (entry) => entry.key === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
  )!;
  const selection = currentApprovedRecord(
    records,
    events,
    definition,
    environmentScope,
    now,
    references,
  );
  if (!selection.record) return selection;
  if (
    !deploymentAuthorizationMatchesSnapshot(
      selection.record.value,
      dependencyFingerprint,
      releaseTarget,
      now,
    )
  ) {
    return {
      record: null,
      configurationReference: null,
      technicalFailure: true,
    };
  }
  return selection;
}

export function evaluateProductionReadiness(
  records: readonly BusinessAuthorityRecord[],
  options: ReadinessOptions &
    Readonly<{ releaseTarget?: ReleaseTargetSnapshot }> = {},
): ProductionAuthorizationPackage {
  const environmentScope = options.environmentScope ?? "PRODUCTION";
  const now = options.now ?? new Date();
  const approvalEvents = options.approvalEvents ?? [];
  const references = options.configurationReferences ?? [];
  const dependencies = evaluateProductionDependencies(records, options);
  if (environmentScope === "STAGING") {
    const approvedItems = dependencies.items.filter((item) => item.approved);
    const pendingItems = dependencies.items.filter((item) => !item.approved);
    const categories = [
      ...new Set(dependencies.items.map((entry) => entry.category)),
    ].map((category) => {
      const categoryItems = dependencies.items.filter(
        (item) => item.category === category,
      );
      const blockerCount = categoryItems.filter(
        (item) => !item.approved,
      ).length;
      return {
        category,
        status:
          blockerCount === 0 ? ("PASS" as const) : ("BLOCKED" as const),
        blockerCount,
      };
    });
    return {
      environmentScope,
      generatedAt: now,
      ready: pendingItems.length === 0,
      approvedItems,
      pendingItems,
      blockers: pendingItems.flatMap((item) => item.blockerCode ?? []),
      categories,
    };
  }
  const deploymentDefinition = businessAuthorityDefinitions.find(
    (definition) =>
      definition.key === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
  )!;
  const items = [
    ...dependencies.items,
    itemForSelection(
      deploymentDefinition,
      deploymentSelection(
        records,
        approvalEvents,
        environmentScope,
        now,
        references,
        dependencies.fingerprint,
        options.releaseTarget,
      ),
    ),
  ];
  const approvedItems = items.filter((item) => item.approved);
  const pendingItems = items.filter((item) => !item.approved);
  const categories = [...new Set(items.map((entry) => entry.category))].map(
    (category) => {
      const categoryItems = items.filter((item) => item.category === category);
      const blockerCount = categoryItems.filter((item) => !item.approved).length;
      return {
        category,
        status:
          blockerCount === 0 ? ("PASS" as const) : ("BLOCKED" as const),
        blockerCount,
      };
    },
  );
  return {
    environmentScope,
    generatedAt: now,
    ready: pendingItems.length === 0,
    approvedItems,
    pendingItems,
    blockers: pendingItems.flatMap((item) => item.blockerCode ?? []),
    categories,
  };
}
