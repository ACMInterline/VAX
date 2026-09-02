import { expectedApprovedStatus } from "./validation";
import type {
  AuthorityStatus,
  AuthorityType,
  BusinessAuthorityRecord,
} from "./types";

export type LifecycleDecision =
  | Readonly<{ action: "SUBMIT_FOR_REVIEW" }>
  | Readonly<{
      action: "APPROVE";
      decisionAuthorityType: AuthorityType;
      existingApprovalTypes: ReadonlySet<AuthorityType>;
    }>
  | Readonly<{ action: "REJECT" }>;

export type LifecycleOutcome = Readonly<{
  previousStatus: AuthorityStatus;
  nextStatus: AuthorityStatus;
  approvalCompletesRecord: boolean;
}>;

export class AuthorityLifecycleError extends Error {
  constructor() {
    super("INVALID_AUTHORITY_TRANSITION");
    this.name = "AuthorityLifecycleError";
  }
}

export function evaluateAuthorityTransition(
  record: BusinessAuthorityRecord,
  decision: LifecycleDecision,
): LifecycleOutcome {
  if (decision.action === "SUBMIT_FOR_REVIEW") {
    if (record.status !== "PROPOSED") throw new AuthorityLifecycleError();
    return {
      previousStatus: record.status,
      nextStatus: "UNDER_REVIEW",
      approvalCompletesRecord: false,
    };
  }

  if (decision.action === "REJECT") {
    if (record.status !== "PROPOSED" && record.status !== "UNDER_REVIEW") {
      throw new AuthorityLifecycleError();
    }
    return {
      previousStatus: record.status,
      nextStatus: "REJECTED",
      approvalCompletesRecord: false,
    };
  }

  if (record.status !== "UNDER_REVIEW") throw new AuthorityLifecycleError();
  if (!record.requiredAuthorityTypes.includes(decision.decisionAuthorityType)) {
    throw new AuthorityLifecycleError();
  }
  if (decision.existingApprovalTypes.has(decision.decisionAuthorityType)) {
    throw new AuthorityLifecycleError();
  }

  const expected = expectedApprovedStatus(record.environmentScope);
  if (!expected) throw new AuthorityLifecycleError();
  const allApprovals = new Set(decision.existingApprovalTypes);
  allApprovals.add(decision.decisionAuthorityType);
  const complete = record.requiredAuthorityTypes.every((authorityType) =>
    allApprovals.has(authorityType),
  );
  return {
    previousStatus: record.status,
    nextStatus: complete ? expected : "UNDER_REVIEW",
    approvalCompletesRecord: complete,
  };
}
