import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { requirePermission, AuthorizationError } from "@/modules/identity-access/authorization";
import { requireApplicationPrincipal } from "../application-principal";

export const requireIdentityAdminPrincipal = cache(async () => {
  const principal = await requireApplicationPrincipal();
  try {
    requirePermission(
      {
        status: principal.profile.status,
        roles: principal.roles,
        permissions: principal.permissions,
      },
      "USER_ADMIN_READ",
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  return principal;
});
