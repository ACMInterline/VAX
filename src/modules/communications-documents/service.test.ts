import { describe, expect, it, vi } from "vitest";
import type { PermissionCode } from "@/modules/identity-access/policy";
import type { CommunicationsAuthorizationFailureCode } from "./policy";
import { projectCommunicationSource } from "./source-projection";
import { canonicalCommunicationTemplates } from "./templates";
import type {
  CommunicationPreferences,
  CommunicationsActor,
  ResolvedDeliveryContext,
} from "./types";
import {
  createCommunicationsService,
  type CommunicationsRepository,
  CommunicationsServiceError,
} from "./service";

const staffProfileId = "10000000-0000-4000-8000-000000000001";
const customerProfileId = "10000000-0000-4000-8000-000000000002";
const sourceId = "20000000-0000-4000-8000-000000000001";
const customerId = "30000000-0000-4000-8000-000000000001";
const auditEventId = "40000000-0000-4000-8000-000000000001";
const contactId = "50000000-0000-4000-8000-000000000001";
const idempotencyKey = "60000000-0000-4000-8000-000000000001";
const quoteReference = "Q-000000000000000000000001";

const quoteSource = projectCommunicationSource(
  "QUOTE_ISSUED",
  "QUOTE_SUMMARY",
  {
    sourceType: "QUOTE",
    sourceId,
    sourceReference: quoteReference,
    sourceVersion: 3,
    customerId,
    bookingOccupancyId: null,
    businessAuditEventId: auditEventId,
    bookingAuditEventId: null,
    jobAuditEventId: null,
    financeAuditEventId: null,
    occurredAt: new Date("2026-08-27T09:00:00.000Z"),
    localeHint: "en",
    payload: {
      sourceSnapshotChecksumSha256: "a".repeat(64),
      sourceAuditEventType: "QUOTE_ISSUED",
      customerName: "Example Customer",
      validUntil: "2026-09-30T21:00:00.000Z",
      grossAmountMinorUnits: 12_000,
      issuedAt: "2026-08-27T09:00:00.000Z",
      propertyLabel: "Example property",
      lineItems: [
        {
          descriptionBg: "Почистване на диван",
          descriptionEn: "Sofa cleaning",
          quantity: 1,
          amountMinorUnits: 12_000,
        },
      ],
      totals: {
        currency: "EUR",
        netAmountMinorUnits: 10_000,
        vatAmountMinorUnits: 2_000,
        grossAmountMinorUnits: 12_000,
      },
    },
  },
);

const preferences: CommunicationPreferences = {
  portalEnabled: true,
  emailFutureEnabled: false,
  smsFutureEnabled: false,
  operationalAllowed: true,
  billingAllowed: true,
  marketingConsent: false,
  preferredLocale: "en",
  version: 1,
};

function activeTemplate(locale: "bg" | "en" = "en") {
  return {
    ...canonicalCommunicationTemplates.find(
      (template) =>
        template.templateKey === "quote_issued" && template.locale === locale,
    )!,
    status: "ACTIVE" as const,
  };
}

function context(
  overrides: Partial<ResolvedDeliveryContext> = {},
): ResolvedDeliveryContext {
  return {
    preferences,
    contact: null,
    locale: "en",
    template: activeTemplate(),
    ...overrides,
  };
}

function actor(
  permissions: readonly PermissionCode[],
  options: Partial<Pick<CommunicationsActor, "profileId" | "status" | "roles">> = {},
): CommunicationsActor {
  return {
    profileId: options.profileId ?? staffProfileId,
    status: options.status ?? "ACTIVE",
    roles: options.roles ?? new Set(["OWNER"]),
    permissions: new Set(permissions),
  };
}

const staffManagePermissions = [
  "COMMUNICATIONS_READ",
  "COMMUNICATIONS_MANAGE",
  "CUSTOMER_RECORDS_READ",
  "OPERATIONS_READ",
] as const satisfies readonly PermissionCode[];

const createInput = {
  eventType: "QUOTE_ISSUED",
  sourceReference: quoteReference,
  documentType: "QUOTE_SUMMARY",
  channel: "PORTAL",
  contactId: null,
  idempotencyKey,
} as const;

function repository(): CommunicationsRepository {
  return {
    resolveSource: vi.fn().mockResolvedValue(quoteSource),
    resolveDeliveryContext: vi.fn().mockResolvedValue(context()),
    persist: vi.fn().mockResolvedValue({
      status: "CREATED",
      communicationReference: "COM-000000000000000000000001",
      documentReference: "DOC-000000000000000000000001",
      intentStatus: "DELIVERED_LOCAL",
    }),
    listStaff: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
    getStaff: vi.fn().mockResolvedValue({
      communicationReference: "COM-000000000000000000000001",
      documentReference: "DOC-000000000000000000000001",
      eventType: "QUOTE_ISSUED",
      documentType: "QUOTE_SUMMARY",
      sourceReference: quoteReference,
      channel: "PORTAL",
      locale: "en",
      status: "DELIVERED_LOCAL",
      title: "Quote",
      createdAt: new Date("2026-08-27T10:00:00.000Z"),
      sourceType: "QUOTE",
      sourceVersion: 3,
      purpose: "OPERATIONAL",
      templateKey: "quote_issued",
      templateVersion: 1,
      contactSelected: false,
      checksumSha256: "b".repeat(64),
      documentStatus: "FINAL",
      finalizedAt: new Date("2026-08-27T10:00:00.000Z"),
    }),
    listCustomerHistory: vi.fn().mockResolvedValue([]),
    getCustomerDocument: vi.fn().mockResolvedValue({
      documentReference: "DOC-000000000000000000000001",
      documentType: "QUOTE_SUMMARY",
      locale: "en",
      status: "FINAL",
      checksumSha256: "b".repeat(64),
      finalizedAt: new Date("2026-08-27T10:00:00.000Z"),
      content: {
        schemaVersion: 1,
        rendererVersion: 1,
        eventType: "QUOTE_ISSUED",
        sourceReference: quoteReference,
        locale: "en",
        title: "Quote",
        body: "Customer-safe content",
        facts: [],
        lineItems: [],
        totals: null,
        notices: [],
      },
    }),
    getOwnPreferences: vi.fn().mockResolvedValue(preferences),
    updateOwnPreferences: vi.fn().mockResolvedValue({
      status: "UPDATED",
      version: 2,
    }),
  };
}

function deterministicReferences() {
  let sequence = 0;
  const generate = (prefix: "COM" | "DOC" | "DEL" | "HIS") => () => {
    sequence += 1;
    return `${prefix}-${sequence.toString(16).toUpperCase().padStart(24, "0")}`;
  };
  return {
    communication: generate("COM"),
    document: generate("DOC"),
    delivery: generate("DEL"),
    history: generate("HIS"),
  };
}

function expectAuthorizationFailure(
  operation: Promise<unknown>,
  code: CommunicationsAuthorizationFailureCode,
) {
  return expect(operation).rejects.toMatchObject({
    name: "CommunicationsAuthorizationError",
    code,
  });
}

function expectServiceFailure(
  operation: Promise<unknown>,
  code: CommunicationsServiceError["code"],
) {
  return expect(operation).rejects.toMatchObject({
    name: "CommunicationsServiceError",
    code,
  });
}

describe("communications service mutation boundary", () => {
  it("enforces the communications layer before any source lookup", async () => {
    const repo = repository();
    const service = createCommunicationsService(repo);

    await expectAuthorizationFailure(
      service.createCommunication(
        actor(["COMMUNICATIONS_READ", "CUSTOMER_RECORDS_READ", "OPERATIONS_READ"]),
        createInput,
      ),
      "PERMISSION_DENIED",
    );
    expect(repo.resolveSource).not.toHaveBeenCalled();
  });

  it("enforces the event-specific source permission conjunction before lookup", async () => {
    const repo = repository();
    const service = createCommunicationsService(repo);

    await expectAuthorizationFailure(
      service.createCommunication(
        actor([
          "COMMUNICATIONS_READ",
          "COMMUNICATIONS_MANAGE",
          "CUSTOMER_RECORDS_READ",
        ]),
        createInput,
      ),
      "PERMISSION_DENIED",
    );
    expect(repo.resolveSource).not.toHaveBeenCalled();
  });

  it("persists rendered provenance and a deterministic idempotency fingerprint", async () => {
    const repo = repository();
    const references = deterministicReferences();
    const service = createCommunicationsService(repo, { references });

    const result = await service.createCommunication(
      actor(staffManagePermissions),
      createInput,
    );

    expect(result.status).toBe("CREATED");
    expect(repo.resolveSource).toHaveBeenCalledWith(staffProfileId, {
      eventType: "QUOTE_ISSUED",
      sourceReference: quoteReference,
      documentType: "QUOTE_SUMMARY",
    });
    expect(repo.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        actorProfileId: staffProfileId,
        idempotencyKey,
        communicationReference: "COM-000000000000000000000001",
        documentReference: "DOC-000000000000000000000002",
        deliveryReference: "DEL-000000000000000000000003",
        historyReference: "HIS-000000000000000000000004",
        intentStatus: "DELIVERED_LOCAL",
        source: expect.objectContaining({
          sourceReference: quoteReference,
          sourceVersion: 3,
          businessAuditEventId: auditEventId,
        }),
        checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        idempotencyFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("retries first and second reference collisions with fresh references", async () => {
    const repo = repository();
    vi.mocked(repo.persist)
      .mockResolvedValueOnce({ status: "REFERENCE_CONFLICT" })
      .mockResolvedValueOnce({ status: "REFERENCE_CONFLICT" })
      .mockResolvedValueOnce({
        status: "CREATED",
        communicationReference: "COM-000000000000000000000009",
        documentReference: "DOC-00000000000000000000000A",
        intentStatus: "DELIVERED_LOCAL",
      });
    const service = createCommunicationsService(repo, {
      references: deterministicReferences(),
    });

    await expect(
      service.createCommunication(actor(staffManagePermissions), createInput),
    ).resolves.toMatchObject({ status: "CREATED" });

    expect(repo.persist).toHaveBeenCalledTimes(3);
    const attempts = vi.mocked(repo.persist).mock.calls.map(([input]) => input);
    expect(attempts.map((attempt) => attempt.communicationReference)).toEqual([
      "COM-000000000000000000000001",
      "COM-000000000000000000000005",
      "COM-000000000000000000000009",
    ]);
    expect(new Set(attempts.map((attempt) => attempt.documentReference)).size).toBe(3);
    expect(new Set(attempts.map((attempt) => attempt.deliveryReference)).size).toBe(3);
    expect(new Set(attempts.map((attempt) => attempt.historyReference)).size).toBe(3);
    expect(new Set(attempts.map((attempt) => attempt.idempotencyFingerprint)).size).toBe(
      1,
    );
  });

  it("fails closed after the bounded reference retry budget", async () => {
    const repo = repository();
    vi.mocked(repo.persist).mockResolvedValue({ status: "REFERENCE_CONFLICT" });
    const service = createCommunicationsService(repo, {
      references: deterministicReferences(),
    });

    await expectServiceFailure(
      service.createCommunication(actor(staffManagePermissions), createInput),
      "CONFLICT",
    );
    expect(repo.persist).toHaveBeenCalledTimes(3);
  });

  it("returns an existing idempotent result without changing its identity", async () => {
    const repo = repository();
    vi.mocked(repo.persist).mockResolvedValue({
      status: "EXISTING",
      communicationReference: "COM-0000000000000000000000AA",
      documentReference: "DOC-0000000000000000000000BB",
      intentStatus: "DELIVERED_LOCAL",
    });
    const service = createCommunicationsService(repo);

    await expect(
      service.createCommunication(actor(staffManagePermissions), createInput),
    ).resolves.toEqual({
      status: "EXISTING",
      communicationReference: "COM-0000000000000000000000AA",
      documentReference: "DOC-0000000000000000000000BB",
      intentStatus: "DELIVERED_LOCAL",
    });
    expect(repo.persist).toHaveBeenCalledTimes(1);
  });

  it("blocks a disabled channel or purpose before persistence", async () => {
    const repo = repository();
    vi.mocked(repo.resolveDeliveryContext).mockResolvedValue(
      context({
        preferences: { ...preferences, portalEnabled: false },
      }),
    );
    const service = createCommunicationsService(repo);

    await expectServiceFailure(
      service.createCommunication(actor(staffManagePermissions), createInput),
      "PREFERENCE_BLOCKED",
    );
    expect(repo.persist).not.toHaveBeenCalled();
  });

  it("uses the authoritative delivery locale and queues future adapters without claiming delivery", async () => {
    const repo = repository();
    vi.mocked(repo.resolveDeliveryContext).mockResolvedValue(
      context({
        preferences: { ...preferences, emailFutureEnabled: true, preferredLocale: "bg" },
        contact: {
          contactId,
          contactName: "Получател",
          email: "customer@example.invalid",
          phone: null,
          locale: "bg",
          version: 2,
        },
        locale: "bg",
        template: activeTemplate("bg"),
      }),
    );
    const service = createCommunicationsService(repo);

    await service.createCommunication(actor(staffManagePermissions), {
      ...createInput,
      channel: "EMAIL_FUTURE",
      contactId,
    });

    expect(repo.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "bg",
        intentStatus: "QUEUED_FUTURE",
        content: expect.objectContaining({
          locale: "bg",
          title: "Оферта Q-000000000000000000000001",
        }),
      }),
    );
  });

  it.each([
    ["NOT_FOUND_OR_FORBIDDEN", "RECORD_NOT_FOUND_OR_FORBIDDEN"],
    ["PREFERENCE_BLOCKED", "PREFERENCE_BLOCKED"],
    ["REVIEW_REQUIRED", "REVIEW_REQUIRED"],
    ["IDEMPOTENCY_CONFLICT", "CONFLICT"],
  ] as const)(
    "maps the repository %s result to a non-disclosing service failure",
    async (status, expectedCode) => {
      const repo = repository();
      vi.mocked(repo.persist).mockResolvedValue({ status });
      const service = createCommunicationsService(repo);

      await expectServiceFailure(
        service.createCommunication(actor(staffManagePermissions), createInput),
        expectedCode,
      );
    },
  );
});

describe("communications service read and preference boundaries", () => {
  it("allows bounded staff reads but not a privileged role label without permission", async () => {
    const repo = repository();
    const service = createCommunicationsService(repo);

    await expect(
      service.listStaffCommunications(actor(["COMMUNICATIONS_READ"]), {}),
    ).resolves.toMatchObject({ total: 0 });
    expect(repo.listStaff).toHaveBeenCalledWith(staffProfileId, {
      limit: 50,
      offset: 0,
    });
    await expectAuthorizationFailure(
      service.listStaffCommunications(actor([]), {}),
      "PERMISSION_DENIED",
    );
  });

  it("keeps staff detail failures non-disclosing", async () => {
    const repo = repository();
    vi.mocked(repo.getStaff).mockResolvedValue(null);
    const service = createCommunicationsService(repo);

    await expectServiceFailure(
      service.getStaffCommunication(actor(["COMMUNICATIONS_READ"]), {
        communicationReference: "COM-000000000000000000000001",
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    expect(repo.getStaff).toHaveBeenCalledWith(
      staffProfileId,
      "COM-000000000000000000000001",
    );
  });

  it("requires own-data read for customer history, documents, and preferences", async () => {
    const repo = repository();
    const service = createCommunicationsService(repo);
    const customer = actor(["OWN_CUSTOMER_DATA_READ"], {
      profileId: customerProfileId,
      roles: new Set(["CUSTOMER"]),
    });

    await expect(service.listMyCommunications(customer)).resolves.toEqual([]);
    await expect(
      service.getMyDocument(customer, {
        documentReference: "DOC-000000000000000000000001",
      }),
    ).resolves.toMatchObject({ documentType: "QUOTE_SUMMARY" });
    await expect(service.getMyPreferences(customer)).resolves.toEqual(preferences);
    expect(repo.listCustomerHistory).toHaveBeenCalledWith(customerProfileId);
    expect(repo.getCustomerDocument).toHaveBeenCalledWith(
      customerProfileId,
      "DOC-000000000000000000000001",
    );
    expect(repo.getOwnPreferences).toHaveBeenCalledWith(customerProfileId);

    await expectAuthorizationFailure(
      service.listMyCommunications(
        actor([], { profileId: customerProfileId, roles: new Set(["CUSTOMER"]) }),
      ),
      "PERMISSION_DENIED",
    );
  });

  it("strictly validates and forwards versioned preference updates", async () => {
    const repo = repository();
    const service = createCommunicationsService(repo);
    const customer = actor(
      ["OWN_CUSTOMER_DATA_READ", "OWN_CUSTOMER_DATA_UPDATE"],
      { profileId: customerProfileId, roles: new Set(["CUSTOMER"]) },
    );
    const update = {
      portalEnabled: true,
      emailFutureEnabled: false,
      smsFutureEnabled: false,
      operationalAllowed: true,
      billingAllowed: true,
      marketingConsent: false,
      preferredLocale: "bg",
      expectedVersion: 1,
    } as const;

    await expect(service.updateMyPreferences(customer, update)).resolves.toEqual({
      status: "UPDATED",
      version: 2,
    });
    expect(repo.updateOwnPreferences).toHaveBeenCalledWith(customerProfileId, update);

    await expectServiceFailure(
      service.updateMyPreferences(customer, { ...update, customerId }),
      "INVALID_REQUEST",
    );
  });

  it("maps optimistic preference conflicts without disclosing record ownership", async () => {
    const repo = repository();
    vi.mocked(repo.updateOwnPreferences).mockResolvedValue({ status: "CONFLICT" });
    const service = createCommunicationsService(repo);
    const customer = actor(
      ["OWN_CUSTOMER_DATA_READ", "OWN_CUSTOMER_DATA_UPDATE"],
      { profileId: customerProfileId, roles: new Set(["CUSTOMER"]) },
    );

    await expectServiceFailure(
      service.updateMyPreferences(customer, {
        portalEnabled: true,
        emailFutureEnabled: false,
        smsFutureEnabled: false,
        operationalAllowed: true,
        billingAllowed: true,
        marketingConsent: false,
        preferredLocale: "en",
        expectedVersion: 1,
      }),
      "CONFLICT",
    );
  });

  it("converts unexpected repository errors to a stable unavailable response", async () => {
    const repo = repository();
    vi.mocked(repo.listCustomerHistory).mockRejectedValue(
      new Error("sensitive provider detail"),
    );
    const service = createCommunicationsService(repo);
    const customer = actor(["OWN_CUSTOMER_DATA_READ"], {
      profileId: customerProfileId,
      roles: new Set(["CUSTOMER"]),
    });

    await expectServiceFailure(
      service.listMyCommunications(customer),
      "TEMPORARILY_UNAVAILABLE",
    );
  });
});
