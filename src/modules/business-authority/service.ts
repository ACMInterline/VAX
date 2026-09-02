import { randomUUID } from "node:crypto";
import { getBusinessAuthorityDefinition } from "./registry";
import {
  evaluateAuthorityTransition,
  AuthorityLifecycleError,
} from "./lifecycle";
import {
  BusinessAuthorityPolicyError,
  requireBusinessAuthorityDecision,
  requireBusinessAuthorityProposal,
  requireBusinessAuthorityRead,
  requireBusinessAuthorityStatusDecision,
} from "./policy";
import { evaluateProductionDependencies } from "./readiness";
import type {
  BusinessAuthorityMutationResult,
  BusinessAuthorityState,
  GovernedAuthorityDecisionInput,
  GovernedAuthorityProposalInput,
  ProductionDependencyApprovalSnapshot,
} from "./repository";
import type { BusinessAuthorityActor } from "./types";
import {
  authorityDecisionSchema,
  authorityProposalSchema,
  type AuthorityDecisionInput,
  type AuthorityProposalInput,
} from "./validation";

export type BusinessAuthorityRepository = Readonly<{
  listState(actorProfileId: string): Promise<BusinessAuthorityState>;
  createProposal(
    actorProfileId: string,
    input: GovernedAuthorityProposalInput,
    correlationId: string,
  ): Promise<BusinessAuthorityMutationResult>;
  transition(
    actorProfileId: string,
    input: GovernedAuthorityDecisionInput,
    correlationId: string,
    supersessionCorrelationId: string,
  ): Promise<BusinessAuthorityMutationResult>;
}>;

export type BusinessAuthorityServiceFailureCode =
  | "DEPENDENCIES_NOT_APPROVED"
  | "INVALID_REQUEST"
  | "INVALID_TRANSITION"
  | "NOT_FOUND_OR_FORBIDDEN"
  | "OPERATION_CONFLICT";

export class BusinessAuthorityServiceError extends Error {
  readonly code: BusinessAuthorityServiceFailureCode;

  constructor(code: BusinessAuthorityServiceFailureCode) {
    super(code);
    this.name = "BusinessAuthorityServiceError";
    this.code = code;
  }
}

function mutationResult(result: BusinessAuthorityMutationResult): {
  status: "CHANGED";
  recordId: string;
} {
  if (result.status === "CHANGED") return result;
  if (result.status === "CONFLICT") {
    throw new BusinessAuthorityServiceError("OPERATION_CONFLICT");
  }
  throw new BusinessAuthorityServiceError("NOT_FOUND_OR_FORBIDDEN");
}

function existingApprovalTypes(
  state: BusinessAuthorityState,
  recordId: string,
) {
  return new Set(
    state.events
      .filter(
        (event) =>
          event.authorityRecordId === recordId &&
          (event.eventType === "AUTHORITY_APPROVAL_RECORDED" ||
            event.eventType === "AUTHORITY_APPROVED") &&
          event.decisionAuthorityType !== null,
      )
      .flatMap((event) => event.decisionAuthorityType ?? []),
  );
}

function productionGoDependencySnapshot(
  state: BusinessAuthorityState,
  recordId: string,
): ProductionDependencyApprovalSnapshot | null {
  const record = state.records.find((candidate) => candidate.id === recordId);
  if (
    record?.authorityKey !== "PRODUCTION_DEPLOYMENT_AUTHORIZATION" ||
    record.environmentScope !== "PRODUCTION" ||
    !record.value ||
    typeof record.value !== "object" ||
    !("kind" in record.value) ||
    !("decisionCode" in record.value) ||
    !("dependencyFingerprint" in record.value) ||
    record.value.kind !== "DEPLOYMENT_AUTHORIZATION" ||
    record.value.decisionCode !== "GO"
  ) {
    return null;
  }

  const dependencies = evaluateProductionDependencies(state.records, {
    environmentScope: "PRODUCTION",
    approvalEvents: state.events,
    configurationReferences: state.configurationReferences,
  });
  if (
    !dependencies.ready ||
    dependencies.fingerprint === null ||
    record.value.dependencyFingerprint !== dependencies.fingerprint
  ) {
    throw new BusinessAuthorityServiceError("DEPENDENCIES_NOT_APPROVED");
  }
  if (dependencies.selectedConfigurationReferences.length > 0) {
    // This repository has no transactional configuration resolver. Never let
    // an earlier in-memory resolver snapshot authorize a production GO.
    throw new BusinessAuthorityServiceError("DEPENDENCIES_NOT_APPROVED");
  }
  return {
    configurationReferenceCount:
      dependencies.selectedConfigurationReferences.length,
    records: dependencies.selectedRecords.map((dependency) => {
      if (
        dependency.status !== "APPROVED_FOR_PRODUCTION" ||
        dependency.approvedAt === null
      ) {
        throw new BusinessAuthorityServiceError("DEPENDENCIES_NOT_APPROVED");
      }
      return {
        id: dependency.id,
        authorityKey: dependency.authorityKey,
        version: dependency.version,
        recordVersion: dependency.recordVersion,
        contentHash: dependency.contentHash,
        status: dependency.status,
      };
    }),
  };
}

export function createBusinessAuthorityService(
  repository: BusinessAuthorityRepository,
) {
  return {
    async listState(
      actor: BusinessAuthorityActor | null,
    ): Promise<BusinessAuthorityState> {
      requireBusinessAuthorityRead(actor);
      return repository.listState(actor!.profileId);
    },

    async propose(
      actor: BusinessAuthorityActor | null,
      input: AuthorityProposalInput,
    ) {
      const parsed = authorityProposalSchema.safeParse(input);
      if (!parsed.success) {
        throw new BusinessAuthorityServiceError("INVALID_REQUEST");
      }
      const definition = getBusinessAuthorityDefinition(
        parsed.data.authorityKey,
      );
      if (!definition) {
        throw new BusinessAuthorityServiceError("INVALID_REQUEST");
      }
      requireBusinessAuthorityProposal(
        actor,
        parsed.data.authorityKey,
        parsed.data.environmentScope,
      );
      return mutationResult(
        await repository.createProposal(
          actor!.profileId,
          { ...parsed.data, definition },
          randomUUID(),
        ),
      );
    },

    async decide(
      actor: BusinessAuthorityActor | null,
      input: AuthorityDecisionInput,
    ) {
      const parsed = authorityDecisionSchema.safeParse(input);
      if (!parsed.success) {
        throw new BusinessAuthorityServiceError("INVALID_REQUEST");
      }
      requireBusinessAuthorityRead(actor);
      const state = await repository.listState(actor!.profileId);
      const record = state.records.find(
        (candidate) => candidate.id === parsed.data.recordId,
      );
      if (!record) {
        throw new BusinessAuthorityServiceError("NOT_FOUND_OR_FORBIDDEN");
      }
      if (
        record.version !== parsed.data.expectedAuthorityVersion ||
        record.recordVersion !== parsed.data.expectedRecordVersion ||
        record.contentHash !== parsed.data.expectedContentHash
      ) {
        throw new BusinessAuthorityServiceError("OPERATION_CONFLICT");
      }
      if (
        parsed.data.action === "APPROVE" &&
        state.records.some(
          (candidate) =>
            candidate.authorityKey === record.authorityKey &&
            candidate.environmentScope === record.environmentScope &&
            candidate.version > record.version,
        )
      ) {
        throw new BusinessAuthorityServiceError("OPERATION_CONFLICT");
      }

      let productionDependencySnapshot: ProductionDependencyApprovalSnapshot | null =
        null;
      try {
        if (parsed.data.action === "APPROVE") {
          requireBusinessAuthorityDecision(
            actor,
            record,
            parsed.data.decisionAuthorityType!,
            parsed.data.evidenceReference,
          );
          evaluateAuthorityTransition(record, {
            action: "APPROVE",
            decisionAuthorityType: parsed.data.decisionAuthorityType!,
            existingApprovalTypes: existingApprovalTypes(state, record.id),
          });
          productionDependencySnapshot = productionGoDependencySnapshot(
            state,
            record.id,
          );
        } else {
          requireBusinessAuthorityStatusDecision(actor, record);
          evaluateAuthorityTransition(record, { action: parsed.data.action });
        }
      } catch (error) {
        if (error instanceof AuthorityLifecycleError) {
          throw new BusinessAuthorityServiceError("INVALID_TRANSITION");
        }
        throw error;
      }

      return mutationResult(
        await repository.transition(
          actor!.profileId,
          { ...parsed.data, productionDependencySnapshot },
          randomUUID(),
          randomUUID(),
        ),
      );
    },
  };
}

export type BusinessAuthorityService = ReturnType<
  typeof createBusinessAuthorityService
>;

export { BusinessAuthorityPolicyError };
