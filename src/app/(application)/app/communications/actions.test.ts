import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { CommunicationsServiceError } from "@/modules/communications-documents/service";

const doubles = vi.hoisted(() => {
  const service = {
    createCommunication: vi.fn(),
    updateMyPreferences: vi.fn(),
  };
  return {
    service,
    requireAuthenticatedUser: vi.fn(),
    isAuthAttemptAllowed: vi.fn(),
    revalidatePath: vi.fn(),
    repositoryFactory: vi.fn(() => ({})),
    serviceFactory: vi.fn(() => service),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/auth/authorization-service", () => ({
  requireAuthenticatedUser: doubles.requireAuthenticatedUser,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/communications-documents/repository", () => ({
  createDatabaseCommunicationsRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/communications-documents/service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/communications-documents/service")
  >()),
  createCommunicationsService: doubles.serviceFactory,
}));

import {
  createPortalCommunicationAction,
  updateCommunicationPreferencesAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const idempotencyKey = "20000000-0000-4000-8000-000000000001";
const communicationReference = "COM-0123456789ABCDEF01234567";
const documentReference = "DOC-0123456789ABCDEF01234567";
const sourceReference = "INV-0123456789ABCDEF01234567";
const initialState = { status: "IDLE" as const };

const staffPrincipal = {
  profile: {
    id: profileId,
    displayName: "Synthetic dispatcher",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  roles: new Set(["DISPATCHER"]),
  permissions: new Set([
    "COMMUNICATIONS_READ",
    "COMMUNICATIONS_MANAGE",
    "CUSTOMER_RECORDS_READ",
    "FINANCE_READ",
  ]),
};

const customerPrincipal = {
  ...staffPrincipal,
  roles: new Set(["CUSTOMER"]),
  permissions: new Set([
    "OWN_CUSTOMER_DATA_READ",
    "OWN_CUSTOMER_DATA_UPDATE",
  ]),
};

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

function validCreateForm(): FormData {
  return form([
    ["eventType", "INVOICE_ISSUED"],
    ["sourceReference", sourceReference],
    ["documentType", "INVOICE"],
    ["idempotencyKey", idempotencyKey],
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireAuthenticatedUser.mockResolvedValue(staffPrincipal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.createCommunication.mockResolvedValue({
    status: "CREATED",
    communicationReference,
    documentReference,
    intentStatus: "DELIVERED_LOCAL",
  });
  doubles.service.updateMyPreferences.mockResolvedValue({
    status: "UPDATED",
    version: 2,
  });
});

describe("Phase 3I communication Server Action boundary", () => {
  it("authenticates before reading any submitted field", async () => {
    doubles.requireAuthenticatedUser.mockRejectedValue(
      new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
    );
    const submitted = validCreateForm();
    const getAll = vi.spyOn(submitted, "getAll");
    const keys = vi.spyOn(submitted, "keys");
    await expect(
      createPortalCommunicationAction(initialState, submitted),
    ).resolves.toEqual({
      status: "ERROR",
      message: "Нямате достъп до тази операция.",
    });
    expect(getAll).not.toHaveBeenCalled();
    expect(keys).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
  });

  it("requires broad management authority before reading the event", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValue({
      ...staffPrincipal,
      permissions: new Set(["COMMUNICATIONS_READ"]),
    });
    const submitted = validCreateForm();
    const getAll = vi.spyOn(submitted, "getAll");
    await createPortalCommunicationAction(initialState, submitted);
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.service.createCommunication).not.toHaveBeenCalled();
  });

  it("checks source-domain permission before consuming the limiter", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValue({
      ...staffPrincipal,
      permissions: new Set([
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
      ]),
    });
    await expect(
      createPortalCommunicationAction(initialState, validCreateForm()),
    ).resolves.toEqual({
      status: "ERROR",
      message: "You do not have access to this operation.",
    });
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.service.createCommunication).not.toHaveBeenCalled();
  });

  it("rate-limits authorized materialization before reading the remaining fields", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValue(false);
    const submitted = validCreateForm();
    const getAll = vi.spyOn(submitted, "getAll");
    const keys = vi.spyOn(submitted, "keys");
    await expect(
      createPortalCommunicationAction(initialState, submitted),
    ).resolves.toEqual({
      status: "ERROR",
      message: "Too many attempts. Wait and try again.",
    });
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll).toHaveBeenCalledWith("eventType");
    expect(keys).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "COMMUNICATION_MUTATION",
      profileId,
    );
  });

  it("passes only server-owned portal delivery fields to the service", async () => {
    await expect(
      createPortalCommunicationAction(initialState, validCreateForm()),
    ).resolves.toEqual({
      status: "SUCCESS",
      message: "The document was finalized and published in the portal.",
      communicationReference,
      documentReference,
    });
    expect(doubles.service.createCommunication).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        eventType: "INVOICE_ISSUED",
        sourceReference,
        documentType: "INVOICE",
        idempotencyKey,
        channel: "PORTAL",
        contactId: null,
      },
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/app/my-communications",
    );
  });

  it("rejects channel and recipient mass assignment", async () => {
    const submitted = validCreateForm();
    submitted.append("channel", "EMAIL_FUTURE");
    submitted.append("contactId", "30000000-0000-4000-8000-000000000001");
    await expect(
      createPortalCommunicationAction(initialState, submitted),
    ).resolves.toMatchObject({ status: "ERROR" });
    expect(doubles.service.createCommunication).not.toHaveBeenCalled();
  });

  it("returns a generic review message without source/provider details", async () => {
    doubles.service.createCommunication.mockRejectedValue(
      new CommunicationsServiceError("REVIEW_REQUIRED"),
    );
    const state = await createPortalCommunicationAction(
      initialState,
      validCreateForm(),
    );
    expect(state).toEqual({
      status: "ERROR",
      message:
        "The source or provenance is not reliable enough. Staff review is required.",
    });
    expect(state.message).not.toMatch(/database|provider|subject|uuid/i);
  });

  it("strictly updates separate service, channel and marketing preferences", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValue(customerPrincipal);
    const submitted = form([
      ["portalEnabled", "true"],
      ["emailFutureEnabled", "true"],
      ["operationalAllowed", "true"],
      ["billingAllowed", "true"],
      ["preferredLocale", "bg"],
      ["expectedVersion", "1"],
    ]);
    await expect(
      updateCommunicationPreferencesAction(initialState, submitted),
    ).resolves.toEqual({
      status: "SUCCESS",
      message: "Preferences were saved.",
    });
    expect(doubles.service.updateMyPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        portalEnabled: true,
        emailFutureEnabled: true,
        smsFutureEnabled: false,
        operationalAllowed: true,
        billingAllowed: true,
        marketingConsent: false,
        preferredLocale: "bg",
        expectedVersion: 1,
      },
    );
  });
});
