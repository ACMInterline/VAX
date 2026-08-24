"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserPermission } from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { adminContent } from "@/content/admin";
import { getDatabase } from "@/db/client";
import type { AdminActionState } from "@/modules/identity-access/admin-action-state";
import {
  createDatabaseIdentityAdministrationRepository,
} from "@/modules/identity-access/admin-repository";
import {
  createIdentityAdministrationService,
  IdentityAdministrationError,
  type IdentityAdministrationActor,
} from "@/modules/identity-access/administration";
import { accountStatuses } from "@/modules/identity-access/authorization";
import { applicationRoleCodes } from "@/modules/identity-access/policy";

const roleMutationSchema = z.object({
  targetProfileId: z.uuid(),
  roleCode: z.enum(applicationRoleCodes),
});

const statusMutationSchema = z.object({
  targetProfileId: z.uuid(),
  status: z.enum(accountStatuses),
});

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireUserPermission>>,
): IdentityAdministrationActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
    // The pinned managed provider exposes no reliable recent-authentication
    // proof. High-risk service operations therefore fail closed.
    authenticatedAt: null,
  };
}

function errorState(
  locale: "bg" | "en",
  error: unknown,
): AdminActionState {
  const copy = adminContent[locale].action;
  if (error instanceof IdentityAdministrationError) {
    switch (error.code) {
      case "INVALID_REQUEST":
      case "INVALID_ROLE":
      case "INVALID_STATUS":
        return { status: "ERROR", message: copy.invalid };
      case "RECENT_AUTHENTICATION_REQUIRED":
        return { status: "ERROR", message: copy.recentAuth };
      case "LAST_ACTIVE_OWNER":
        return { status: "ERROR", message: copy.lastOwner };
      case "AUTHENTICATION_REQUIRED":
      case "ACCOUNT_UNAVAILABLE":
      case "PERMISSION_DENIED":
      case "SELF_ACTION_FORBIDDEN":
        return { status: "ERROR", message: copy.forbidden };
      case "ROLE_INACTIVE":
      case "TARGET_NOT_FOUND":
      case "OPERATION_FAILED":
        return { status: "ERROR", message: copy.unavailable };
    }
  }
  return { status: "ERROR", message: copy.unavailable };
}

async function mutationContext() {
  const principal = await requireUserPermission("USER_ADMIN_MANAGE");
  const locale = principal.profile.preferredLocale;
  if (!(await isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id))) {
    return {
      ok: false,
      failure: {
        status: "ERROR",
        message: adminContent[locale].action.rateLimited,
      } satisfies AdminActionState,
      locale,
    } as const;
  }

  return {
    ok: true,
    actor: actorFromPrincipal(principal),
    locale,
    service: createIdentityAdministrationService({
      repository: createDatabaseIdentityAdministrationRepository(getDatabase()),
    }),
  } as const;
}

function successState(
  locale: "bg" | "en",
  result: { status: "CHANGED" | "NO_CHANGE" },
): AdminActionState {
  return {
    status: "SUCCESS",
    message:
      result.status === "CHANGED"
        ? adminContent[locale].action.success
        : adminContent[locale].action.noChange,
  };
}

function refreshIdentityPages(profileId: string) {
  revalidatePath("/app/admin/users");
  revalidatePath(`/app/admin/users/${profileId}`);
  revalidatePath("/app");
}

async function roleMutationAction(
  operation: "ASSIGN" | "REVOKE",
  formData: FormData,
): Promise<AdminActionState> {
  let locale: "bg" | "en" = "bg";
  try {
    const context = await mutationContext();
    locale = context.locale;
    if (!context.ok) return context.failure;

    const input = roleMutationSchema.safeParse({
      targetProfileId: formString(formData, "targetProfileId"),
      roleCode: formString(formData, "roleCode"),
    });
    if (!input.success) {
      return { status: "ERROR", message: adminContent[locale].action.invalid };
    }

    const result =
      operation === "ASSIGN"
        ? await context.service.assignRole(context.actor, input.data)
        : await context.service.revokeRole(context.actor, input.data);
    refreshIdentityPages(input.data.targetProfileId);
    return successState(locale, result);
  } catch (error) {
    return errorState(locale, error);
  }
}

export async function assignRoleAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return roleMutationAction("ASSIGN", formData);
}

export async function revokeRoleAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return roleMutationAction("REVOKE", formData);
}

export async function changeStatusAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let locale: "bg" | "en" = "bg";
  try {
    const context = await mutationContext();
    locale = context.locale;
    if (!context.ok) return context.failure;

    const input = statusMutationSchema.safeParse({
      targetProfileId: formString(formData, "targetProfileId"),
      status: formString(formData, "status"),
    });
    if (!input.success) {
      return { status: "ERROR", message: adminContent[locale].action.invalid };
    }

    const result = await context.service.changeStatus(context.actor, input.data);
    refreshIdentityPages(input.data.targetProfileId);
    return successState(locale, result);
  } catch (error) {
    return errorState(locale, error);
  }
}
