import { getBusinessAuthorityDefinition } from "./registry";
import type {
  AuthorityEnvironmentScope,
  AuthorityType,
  BusinessAuthorityActor,
  BusinessAuthorityRecord,
} from "./types";

export type BusinessAuthorityFailureCode =
  | "ACCOUNT_UNAVAILABLE"
  | "AUTHENTICATION_REQUIRED"
  | "EXTERNAL_EVIDENCE_REQUIRED"
  | "PERMISSION_DENIED"
  | "SYSTEM_EVIDENCE_REQUIRED";

export class BusinessAuthorityPolicyError extends Error {
  readonly code: BusinessAuthorityFailureCode;

  constructor(code: BusinessAuthorityFailureCode) {
    super(code);
    this.name = "BusinessAuthorityPolicyError";
    this.code = code;
  }
}

function activeActor(actor: BusinessAuthorityActor | null): BusinessAuthorityActor {
  if (!actor) throw new BusinessAuthorityPolicyError("AUTHENTICATION_REQUIRED");
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new BusinessAuthorityPolicyError("ACCOUNT_UNAVAILABLE");
  }
  return actor;
}

function owner(actor: BusinessAuthorityActor): boolean {
  return actor.roles.has("OWNER");
}

export function requireBusinessAuthorityRead(
  actor: BusinessAuthorityActor | null,
): void {
  const current = activeActor(actor);
  if (!current.permissions.has("SYSTEM_SETTINGS_READ")) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
}

export function requireBusinessAuthorityProposal(
  actor: BusinessAuthorityActor | null,
  authorityKey: string,
  environmentScope: AuthorityEnvironmentScope,
): void {
  const current = activeActor(actor);
  const definition = getBusinessAuthorityDefinition(authorityKey);
  if (!definition) throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  if (definition.evidenceClass === "SYSTEM_VERIFIED") {
    throw new BusinessAuthorityPolicyError("SYSTEM_EVIDENCE_REQUIRED");
  }
  if (!current.permissions.has("SYSTEM_SETTINGS_MANAGE") || !owner(current)) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
  if (
    environmentScope === "PRODUCTION" &&
    definition.highRisk &&
    !owner(current)
  ) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
}

export function requireBusinessAuthorityDecision(
  actor: BusinessAuthorityActor | null,
  record: BusinessAuthorityRecord,
  decisionAuthorityType: AuthorityType,
  evidenceReference: string | null,
): void {
  const current = activeActor(actor);
  const definition = getBusinessAuthorityDefinition(record.authorityKey);
  if (!definition || definition.category !== record.category) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
  if (!record.requiredAuthorityTypes.includes(decisionAuthorityType)) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }

  if (!current.permissions.has("SYSTEM_SETTINGS_MANAGE")) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }

  const externalAuthority =
    decisionAuthorityType === "ACCOUNTANT" ||
    decisionAuthorityType === "LEGAL";
  if (externalAuthority && evidenceReference === null) {
    throw new BusinessAuthorityPolicyError("EXTERNAL_EVIDENCE_REQUIRED");
  }

  // Conceptual authorities are not application roles. Until VAX has a
  // separately governed delegation registry, only an Owner may attest that a
  // required operational, technical, content, accountant, or legal decision
  // was actually obtained. Selecting an authority type never grants it.
  if (!owner(current)) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
}

export function requireBusinessAuthorityStatusDecision(
  actor: BusinessAuthorityActor | null,
  record: BusinessAuthorityRecord,
): void {
  const current = activeActor(actor);
  const definition = getBusinessAuthorityDefinition(record.authorityKey);
  if (!definition) throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  if (!current.permissions.has("SYSTEM_SETTINGS_MANAGE")) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
  if (!owner(current)) {
    throw new BusinessAuthorityPolicyError("PERMISSION_DENIED");
  }
}
