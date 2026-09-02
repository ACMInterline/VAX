import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import {
  requireAnyPermission,
  requirePermission,
  AuthorizationError,
} from "@/modules/identity-access/authorization";
import { requireApplicationPrincipal } from "../application-principal";

function authorizationContext(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
) {
  return {
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function denyAdministration(error: unknown): never {
  if (error instanceof AuthorizationError) {
    redirect("/app?access=denied");
  }
  throw error;
}

export const requireAdministrationPrincipal = cache(async () => {
  const principal = await requireApplicationPrincipal();
  try {
    requireAnyPermission(authorizationContext(principal), [
      "USER_ADMIN_READ",
      "SYSTEM_SETTINGS_READ",
    ]);
  } catch (error) {
    denyAdministration(error);
  }
  return principal;
});

export const requireIdentityAdminPrincipal = cache(async () => {
  const principal = await requireApplicationPrincipal();
  try {
    requirePermission(authorizationContext(principal), "USER_ADMIN_READ");
  } catch (error) {
    denyAdministration(error);
  }
  return principal;
});

export const requireBusinessAuthorityPrincipal = cache(async () => {
  const principal = await requireApplicationPrincipal();
  try {
    requirePermission(authorizationContext(principal), "SYSTEM_SETTINGS_READ");
  } catch (error) {
    denyAdministration(error);
  }
  return principal;
});
