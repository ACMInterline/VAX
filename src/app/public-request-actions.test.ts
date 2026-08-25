import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicContent } from "@/content/public-site";

const doubles = vi.hoisted(() => ({
  database: {},
  isAuthAttemptAllowed: vi.fn(),
  repository: {},
  repositoryFactory: vi.fn(),
  serviceFactory: vi.fn(),
  createPublicRequest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({
  getDatabase: vi.fn(() => doubles.database),
}));
vi.mock("@/modules/request-quote/repository", () => ({
  createDatabaseRequestQuoteRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/request-quote/service", () => ({
  createRequestQuoteService: doubles.serviceFactory,
}));

import {
  submitPublicRequestBgAction,
  submitPublicRequestEnAction,
} from "./public-request-actions";
import { publicSubmissionSnapshot } from "@/modules/public-request/submission-snapshot";

const initialState = { status: "IDLE" as const };

function validForm(): FormData {
  const formData = new FormData();
  formData.set("name", "  Public Customer  ");
  formData.set("email", "  CUSTOMER@EXAMPLE.COM  ");
  formData.set("phone", "+359 88 123 4567");
  formData.set("district", "Lozenets");
  formData.set("propertyType", "apartment");
  formData.append("services", "CARPET_FIXED");
  formData.append("services", "SOFA_3_SEAT");
  formData.set("estimatedQuantity", "1 sofa, 2 rooms");
  formData.set("approximateArea", "35 m2");
  formData.set("condition", "NOTICEABLY_SOILED");
  formData.set("stainsPresent", "yes");
  formData.set("delicateMaterial", "on");
  formData.set("preferredDate", "2026-09-10");
  formData.set("preferredTime", "morning");
  formData.set("notes", "Please assess a wool rug separately.");
  formData.set("website", "");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.repositoryFactory.mockReturnValue(doubles.repository);
  doubles.serviceFactory.mockReturnValue({
    createPublicRequest: doubles.createPublicRequest,
  });
  doubles.createPublicRequest.mockResolvedValue({
    requestReference: "REQ-0123456789ABCDEF01234567",
    version: 1,
  });
});

describe("public request Server Actions", () => {
  it("rejects invalid input before rate limiting or persistence and returns bounded field errors", async () => {
    const formData = validForm();
    formData.set("email", "not-an-email");
    formData.set("notes", "x".repeat(1_700));

    const result = await submitPublicRequestEnAction(initialState, formData);

    expect(result).toMatchObject({
      status: "ERROR",
      message: getPublicContent("en").requestForm.notices.errorText,
      values: {
        email: "not-an-email",
        notes: "x".repeat(1_500),
      },
    });
    expect(result.status === "ERROR" && result.fieldErrors?.email).toContain(
      "Enter a valid email address.",
    );
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.createPublicRequest).not.toHaveBeenCalled();
  });

  it("rejects a filled bot trap without reflecting or persisting it", async () => {
    const formData = validForm();
    formData.set("website", "https://bot.invalid");

    const result = await submitPublicRequestBgAction(initialState, formData);

    expect(result.status).toBe("ERROR");
    expect(result).not.toHaveProperty("values.website");
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.createPublicRequest).not.toHaveBeenCalled();
  });

  it("creates an unlinked public request with normalized contact data and a safe original-submission snapshot", async () => {
    const result = await submitPublicRequestEnAction(initialState, validForm());

    expect(result).toEqual({
      status: "SUCCESS",
      requestReference: "REQ-0123456789ABCDEF01234567",
    });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "PUBLIC_REQUEST",
      "anonymous-request",
    );
    expect(doubles.repositoryFactory).toHaveBeenCalledWith(doubles.database);
    expect(doubles.serviceFactory).toHaveBeenCalledWith(doubles.repository);
    expect(doubles.createPublicRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLocale: "en",
        contactName: "Public Customer",
        contactEmail: "customer@example.com",
        contactPhone: "+359 88 123 4567",
        itemTypeCodes: ["CARPET_FIXED", "SOFA_3_SEAT"],
        conditionLevelCode: "NOTICEABLY_SOILED",
        originalSubmission: expect.objectContaining({
          schemaVersion: 1,
          district: "Lozenets",
          propertyType: "apartment",
          itemTypeCodes: ["CARPET_FIXED", "SOFA_3_SEAT"],
          preferredWindowCode: "MORNING",
        }),
      }),
    );
    const persisted = doubles.createPublicRequest.mock.calls[0]?.[0];
    expect(persisted).not.toHaveProperty("customerId");
    expect(persisted).not.toHaveProperty("requestingProfileId");
    expect(persisted).not.toHaveProperty("propertyId");
    expect(persisted.originalSubmission).not.toHaveProperty("website");
  });

  it("keeps the Bulgarian route locale at the persistence boundary", async () => {
    await submitPublicRequestBgAction(initialState, validForm());

    expect(doubles.createPublicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ preferredLocale: "bg" }),
    );
  });

  it("returns the same generic localized failure when throttled or persistence fails", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValueOnce(false);
    const throttled = await submitPublicRequestEnAction(
      initialState,
      validForm(),
    );
    expect(throttled).toMatchObject({
      status: "ERROR",
      message: getPublicContent("en").requestForm.notices.errorText,
    });
    expect(doubles.createPublicRequest).not.toHaveBeenCalled();

    doubles.isAuthAttemptAllowed.mockResolvedValueOnce(true);
    doubles.createPublicRequest.mockRejectedValueOnce(
      new Error("sensitive provider detail"),
    );
    const failed = await submitPublicRequestEnAction(initialState, validForm());
    expect(failed).toMatchObject({
      status: "ERROR",
      message: getPublicContent("en").requestForm.notices.errorText,
    });
    expect(JSON.stringify(failed)).not.toContain("sensitive provider detail");
  });

  it("returns the generic public failure when abuse-control infrastructure rejects", async () => {
    doubles.isAuthAttemptAllowed.mockRejectedValueOnce(
      new Error("sensitive rate-limit provider detail"),
    );

    const result = await submitPublicRequestEnAction(initialState, validForm());

    expect(result).toMatchObject({
      status: "ERROR",
      message: getPublicContent("en").requestForm.notices.errorText,
    });
    expect(JSON.stringify(result)).not.toContain(
      "sensitive rate-limit provider detail",
    );
    expect(doubles.createPublicRequest).not.toHaveBeenCalled();
  });

});

describe("public submission snapshot", () => {
  it("contains only allowlisted operational fields", () => {
    const input = {
      name: "Public Customer",
      email: "customer@example.com",
      phone: "+359 88 123 4567",
      district: "Lozenets",
      propertyType: "apartment" as const,
      services: ["CARPET_FIXED" as const],
      estimatedQuantity: "one",
      approximateArea: "20 m2",
      condition: "LIGHT_MAINTENANCE" as const,
      stainsPresent: "no" as const,
      delicateMaterial: false,
      preferredDate: "2026-09-10",
      preferredTime: "flexible" as const,
      notes: "Customer wording",
    };

    expect(publicSubmissionSnapshot(input)).toEqual({
      schemaVersion: 1,
      district: "Lozenets",
      propertyType: "apartment",
      itemTypeCodes: ["CARPET_FIXED"],
      estimatedQuantity: "one",
      approximateArea: "20 m2",
      conditionLevelCode: "LIGHT_MAINTENANCE",
      stainsPresent: "no",
      delicateMaterial: false,
      preferredDate: "2026-09-10",
      preferredWindowCode: "FLEXIBLE",
      customerNotes: "Customer wording",
    });
  });
});
