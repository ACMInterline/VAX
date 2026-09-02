"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireUserPermission,
  type AuthenticatedPrincipal,
} from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { ApplicationActionState } from "@/components/application/action-status";
import { businessAuthorityContent } from "@/content/business-authority";
import { getDatabase } from "@/db/client";
import { AuthorizationError } from "@/modules/identity-access/authorization";
import { createDatabaseBusinessAuthorityRepository } from "@/modules/business-authority/repository";
import {
  BusinessAuthorityPolicyError,
  BusinessAuthorityServiceError,
  createBusinessAuthorityService,
} from "@/modules/business-authority/service";
import type { BusinessAuthorityActor } from "@/modules/business-authority/types";
import {
  authorityDecisionSchema,
  authorityProposalSchema,
  parseAuthorityValueJson,
} from "@/modules/business-authority/validation";

const proposalFields = new Set([
  "authorityKey",
  "environmentScope",
  "valueJson",
  "sourceReference",
  "safeEvidenceSummary",
  "internalNotes",
  "effectiveFrom",
  "effectiveUntil",
]);

const decisionFields = new Set([
  "recordId",
  "expectedAuthorityVersion",
  "expectedRecordVersion",
  "expectedContentHash",
  "action",
  "decisionAuthorityType",
  "evidenceReference",
  "safeEvidenceSummary",
]);

const explicitTimestampSchema = z.iso.datetime({ offset: true });

function actorFromPrincipal(
  principal: AuthenticatedPrincipal,
): BusinessAuthorityActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function scalar(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function nullableScalar(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  return value === "" || value === undefined ? null : value;
}

function nonnegativeInteger(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function exactFields(
  formData: FormData,
  allowed: ReadonlySet<string>,
): boolean {
  for (const name of formData.keys()) {
    if (!allowed.has(name) && !name.startsWith("$ACTION_")) return false;
  }
  return true;
}

function parsedDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const timestamp = explicitTimestampSchema.safeParse(value);
  if (!timestamp.success) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function mutationContext() {
  const principal = await requireUserPermission("SYSTEM_SETTINGS_MANAGE");
  const locale = principal.profile.preferredLocale;
  if (!(await isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id))) {
    return {
      ok: false,
      locale,
      failure: {
        status: "ERROR",
        message: businessAuthorityContent[locale].actionResult.rateLimited,
      } satisfies ApplicationActionState,
    } as const;
  }
  return {
    ok: true,
    locale,
    actor: actorFromPrincipal(principal),
    service: createBusinessAuthorityService(
      createDatabaseBusinessAuthorityRepository(
        getDatabase(),
        principal.identity.id,
      ),
    ),
  } as const;
}

function failureState(
  locale: AuthLocale,
  error: unknown,
): ApplicationActionState {
  const copy = businessAuthorityContent[locale].actionResult;
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof AuthorizationError ||
    error instanceof BusinessAuthorityPolicyError
  ) {
    return { status: "ERROR", message: copy.forbidden };
  }
  if (error instanceof BusinessAuthorityServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
      case "INVALID_TRANSITION":
        return { status: "ERROR", message: copy.invalid };
      case "DEPENDENCIES_NOT_APPROVED":
        return { status: "ERROR", message: copy.dependencies };
      case "OPERATION_CONFLICT":
        return { status: "ERROR", message: copy.conflict };
      case "NOT_FOUND_OR_FORBIDDEN":
        return { status: "ERROR", message: copy.forbidden };
    }
  }
  return { status: "ERROR", message: copy.unavailable };
}

function invalidState(locale: AuthLocale): ApplicationActionState {
  return {
    status: "ERROR",
    message: businessAuthorityContent[locale].actionResult.invalid,
  };
}

function successState(locale: AuthLocale): ApplicationActionState {
  return {
    status: "SUCCESS",
    message: businessAuthorityContent[locale].actionResult.success,
  };
}

export async function createAuthorityProposalAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  let locale: AuthLocale = "bg";
  try {
    // Authentication, permission enforcement, and shared rate limiting happen
    // before any browser-controlled FormData is read.
    const context = await mutationContext();
    locale = context.locale;
    if (!context.ok) return context.failure;
    if (!exactFields(formData, proposalFields)) return invalidState(locale);

    const valueJson = scalar(formData, "valueJson");
    if (typeof valueJson !== "string") return invalidState(locale);
    let value: unknown;
    try {
      value = parseAuthorityValueJson(valueJson);
    } catch {
      return invalidState(locale);
    }

    const input = authorityProposalSchema.safeParse({
      authorityKey: scalar(formData, "authorityKey"),
      environmentScope: scalar(formData, "environmentScope"),
      value,
      sourceReference: nullableScalar(formData, "sourceReference"),
      safeEvidenceSummary: nullableScalar(formData, "safeEvidenceSummary"),
      internalNotes: nullableScalar(formData, "internalNotes"),
      effectiveFrom: parsedDate(scalar(formData, "effectiveFrom")),
      effectiveUntil: parsedDate(nullableScalar(formData, "effectiveUntil")),
    });
    if (!input.success) return invalidState(locale);
    if (input.data.environmentScope === "DEVELOPMENT") {
      return invalidState(locale);
    }

    await context.service.propose(context.actor, input.data);
    revalidatePath("/app/admin/business-authority");
    return successState(locale);
  } catch (error) {
    return failureState(locale, error);
  }
}

export async function transitionAuthorityAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  let locale: AuthLocale = "bg";
  try {
    // Keep this ordering aligned with proposal creation: no client field is
    // parsed until the current session has been reauthorized and rate-limited.
    const context = await mutationContext();
    locale = context.locale;
    if (!context.ok) return context.failure;
    if (!exactFields(formData, decisionFields)) return invalidState(locale);

    const input = authorityDecisionSchema.safeParse({
      recordId: scalar(formData, "recordId"),
      expectedAuthorityVersion: nonnegativeInteger(
        formData,
        "expectedAuthorityVersion",
      ),
      expectedRecordVersion: nonnegativeInteger(
        formData,
        "expectedRecordVersion",
      ),
      expectedContentHash: scalar(formData, "expectedContentHash"),
      action: scalar(formData, "action"),
      decisionAuthorityType: nullableScalar(formData, "decisionAuthorityType"),
      evidenceReference: nullableScalar(formData, "evidenceReference"),
      safeEvidenceSummary: nullableScalar(formData, "safeEvidenceSummary"),
    });
    if (!input.success) return invalidState(locale);

    await context.service.decide(context.actor, input.data);
    revalidatePath("/app/admin/business-authority");
    return successState(locale);
  } catch (error) {
    return failureState(locale, error);
  }
}
