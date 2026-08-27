import { z, ZodError } from "zod";
import {
  requireCustomerCommunicationRead,
  requireCustomerCommunicationUpdate,
  requireStaffCommunicationManage,
  requireStaffCommunicationsManage,
  requireStaffCommunicationsRead,
} from "./policy";
import {
  communicationFingerprint,
  documentChecksum,
  renderDocument,
  TemplateRenderError,
} from "./renderer";
import {
  generateCommunicationReference,
  generateDeliveryReference,
  generateDocumentReference,
  generateHistoryReference,
} from "./reference";
import { localizeCommunicationSource, SourceProjectionError } from "./source-projection";
import type {
  CommunicationDocumentType,
  CommunicationEventType,
  CommunicationIntentStatus,
  CommunicationMutationResult,
  CommunicationPreferences,
  CommunicationsActor,
  CustomerDocumentDetail,
  CustomerHistorySummary,
  PersistCommunicationInput,
  PreferencesMutationResult,
  ResolvedCommunicationSource,
  ResolvedDeliveryContext,
  StaffCommunicationDetail,
  StaffCommunicationPage,
  UpdateCommunicationPreferencesInput,
} from "./types";
import {
  communicationListSchema,
  communicationReferenceSchema,
  createCommunicationSchema,
  documentContentSnapshotSchema,
  documentReferenceSchema,
  updateCommunicationPreferencesSchema,
} from "./validation";

export type CommunicationsRepository = Readonly<{
  resolveSource(
    actorProfileId: string,
    input: Readonly<{
      eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">;
      sourceReference: string;
      documentType: CommunicationDocumentType;
    }>,
  ): Promise<ResolvedCommunicationSource | null>;
  resolveDeliveryContext(
    actorProfileId: string,
    source: ResolvedCommunicationSource,
    input: Readonly<{
      channel: "PORTAL" | "EMAIL_FUTURE" | "SMS_FUTURE";
      contactId: string | null;
    }>,
  ): Promise<ResolvedDeliveryContext | null>;
  persist(input: PersistCommunicationInput): Promise<CommunicationMutationResult>;
  listStaff(
    actorProfileId: string,
    input: Readonly<{
      status?: CommunicationIntentStatus;
      limit: number;
      offset: number;
    }>,
  ): Promise<StaffCommunicationPage>;
  getStaff(
    actorProfileId: string,
    reference: string,
  ): Promise<StaffCommunicationDetail | null>;
  listCustomerHistory(
    actorProfileId: string,
  ): Promise<readonly CustomerHistorySummary[]>;
  getCustomerDocument(
    actorProfileId: string,
    reference: string,
  ): Promise<CustomerDocumentDetail | null>;
  getOwnPreferences(
    actorProfileId: string,
  ): Promise<CommunicationPreferences | null>;
  updateOwnPreferences(
    actorProfileId: string,
    input: UpdateCommunicationPreferencesInput,
  ): Promise<PreferencesMutationResult>;
}>;

export type CommunicationsServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "PREFERENCE_BLOCKED"
  | "REVIEW_REQUIRED"
  | "CONFLICT"
  | "TEMPORARILY_UNAVAILABLE";

export class CommunicationsServiceError extends Error {
  readonly code: CommunicationsServiceFailureCode;

  constructor(code: CommunicationsServiceFailureCode) {
    super(code);
    this.name = "CommunicationsServiceError";
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CommunicationsServiceError("INVALID_REQUEST");
    }
    throw error;
  }
}

async function operation<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof CommunicationsServiceError) throw error;
    if (
      error instanceof SourceProjectionError ||
      error instanceof TemplateRenderError
    ) {
      throw new CommunicationsServiceError("REVIEW_REQUIRED");
    }
    throw new CommunicationsServiceError("TEMPORARILY_UNAVAILABLE");
  }
}

function preferenceAllows(
  source: ResolvedCommunicationSource,
  context: ResolvedDeliveryContext,
  channel: "PORTAL" | "EMAIL_FUTURE" | "SMS_FUTURE",
): boolean {
  const channelAllowed =
    channel === "PORTAL"
      ? context.preferences.portalEnabled
      : channel === "EMAIL_FUTURE"
        ? context.preferences.emailFutureEnabled
        : context.preferences.smsFutureEnabled;
  const purposeAllowed =
    source.purpose === "OPERATIONAL"
      ? context.preferences.operationalAllowed
      : context.preferences.billingAllowed;
  return channelAllowed && purposeAllowed;
}

function checkedMutationResult(
  result: CommunicationMutationResult,
): CommunicationMutationResult {
  switch (result.status) {
    case "CREATED":
    case "EXISTING":
    case "REFERENCE_CONFLICT":
      return result;
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
    case "PREFERENCE_BLOCKED":
      throw new CommunicationsServiceError("PREFERENCE_BLOCKED");
    case "REVIEW_REQUIRED":
      throw new CommunicationsServiceError("REVIEW_REQUIRED");
    case "IDEMPOTENCY_CONFLICT":
      throw new CommunicationsServiceError("CONFLICT");
  }
}

function checkedPreferencesResult(
  result: PreferencesMutationResult,
): PreferencesMutationResult {
  if (result.status === "UPDATED") return result;
  if (result.status === "NOT_FOUND_OR_FORBIDDEN") {
    throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  throw new CommunicationsServiceError("CONFLICT");
}

type ReferenceGenerators = Readonly<{
  communication: () => string;
  document: () => string;
  delivery: () => string;
  history: () => string;
}>;

const defaultReferenceGenerators: ReferenceGenerators = {
  communication: generateCommunicationReference,
  document: generateDocumentReference,
  delivery: generateDeliveryReference,
  history: generateHistoryReference,
};

export function createCommunicationsService(
  repository: CommunicationsRepository,
  options: Readonly<{ references?: ReferenceGenerators }> = {},
) {
  const references = options.references ?? defaultReferenceGenerators;

  return {
    async createCommunication(actor: CommunicationsActor | null, input: unknown) {
      requireStaffCommunicationsManage(actor);
      const parsed = parse(createCommunicationSchema, input);
      requireStaffCommunicationManage(actor, parsed.eventType);

      const source = await operation(() =>
        repository.resolveSource(actor!.profileId, {
          eventType: parsed.eventType,
          sourceReference: parsed.sourceReference,
          documentType: parsed.documentType,
        }),
      );
      if (!source) {
        throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }

      const context = await operation(() =>
        repository.resolveDeliveryContext(actor!.profileId, source, {
          channel: parsed.channel,
          contactId: parsed.contactId,
        }),
      );
      if (!context) {
        throw new CommunicationsServiceError("REVIEW_REQUIRED");
      }
      if (!preferenceAllows(source, context, parsed.channel)) {
        throw new CommunicationsServiceError("PREFERENCE_BLOCKED");
      }

      const localizedSource = await operation(async () =>
        localizeCommunicationSource(source, context.locale),
      );
      const content = await operation(async () =>
        renderDocument(context.template, localizedSource),
      );
      const contentResult = documentContentSnapshotSchema.safeParse(content);
      if (!contentResult.success) {
        throw new CommunicationsServiceError("REVIEW_REQUIRED");
      }
      const checkedContent = contentResult.data;
      const checksumSha256 = documentChecksum(context.template, checkedContent);
      const idempotencyFingerprint = communicationFingerprint({
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceReference: source.sourceReference,
        sourceVersion: source.sourceVersion,
        businessAuditEventId: source.businessAuditEventId,
        bookingAuditEventId: source.bookingAuditEventId,
        jobAuditEventId: source.jobAuditEventId,
        financeAuditEventId: source.financeAuditEventId,
        bookingOccupancyId: source.bookingOccupancyId,
        eventType: source.eventType,
        documentType: parsed.documentType,
        channel: parsed.channel,
        locale: context.locale,
        contact: context.contact,
        templateKey: context.template.templateKey,
        templateVersion: context.template.version,
        checksumSha256,
      });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = checkedMutationResult(
          await operation(() =>
            repository.persist({
              ...parsed,
              communicationReference: references.communication(),
              documentReference: references.document(),
              deliveryReference: references.delivery(),
              historyReference: references.history(),
              actorProfileId: actor!.profileId,
              source: localizedSource,
              template: context.template,
              contact: context.contact,
              locale: context.locale,
              intentStatus:
                parsed.channel === "PORTAL"
                  ? "DELIVERED_LOCAL"
                  : "QUEUED_FUTURE",
              content: checkedContent,
              checksumSha256,
              idempotencyFingerprint,
            }),
          ),
        );
        if (result.status === "CREATED" || result.status === "EXISTING") {
          return result;
        }
      }
      throw new CommunicationsServiceError("CONFLICT");
    },

    async listStaffCommunications(
      actor: CommunicationsActor | null,
      input: unknown,
    ) {
      requireStaffCommunicationsRead(actor);
      const parsed = parse(communicationListSchema, input);
      return operation(() => repository.listStaff(actor!.profileId, parsed));
    },

    async getStaffCommunication(
      actor: CommunicationsActor | null,
      input: unknown,
    ) {
      requireStaffCommunicationsRead(actor);
      const reference = parse(
        communicationReferenceSchema,
        (input as { communicationReference?: unknown })?.communicationReference,
      );
      const record = await operation(() =>
        repository.getStaff(actor!.profileId, reference),
      );
      if (!record) {
        throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return record;
    },

    async listMyCommunications(actor: CommunicationsActor | null) {
      requireCustomerCommunicationRead(actor);
      return operation(() => repository.listCustomerHistory(actor!.profileId));
    },

    async getMyDocument(actor: CommunicationsActor | null, input: unknown) {
      requireCustomerCommunicationRead(actor);
      const reference = parse(
        documentReferenceSchema,
        (input as { documentReference?: unknown })?.documentReference,
      );
      const record = await operation(() =>
        repository.getCustomerDocument(actor!.profileId, reference),
      );
      if (!record) {
        throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return record;
    },

    async getMyPreferences(actor: CommunicationsActor | null) {
      requireCustomerCommunicationRead(actor);
      const record = await operation(() =>
        repository.getOwnPreferences(actor!.profileId),
      );
      if (!record) {
        throw new CommunicationsServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return record;
    },

    async updateMyPreferences(actor: CommunicationsActor | null, input: unknown) {
      requireCustomerCommunicationUpdate(actor);
      const parsed = parse(updateCommunicationPreferencesSchema, input);
      return checkedPreferencesResult(
        await operation(() =>
          repository.updateOwnPreferences(actor!.profileId, parsed),
        ),
      );
    },
  };
}

export type CommunicationsService = ReturnType<
  typeof createCommunicationsService
>;
