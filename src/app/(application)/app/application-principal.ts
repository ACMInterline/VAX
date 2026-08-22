import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  AuthenticationBoundaryError,
  requireAuthenticatedUser,
} from "@/auth/authorization-service";

export const requireApplicationPrincipal = cache(async () => {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthenticationBoundaryError) {
      if (error.code === "EMAIL_VERIFICATION_REQUIRED") {
        redirect("/verify-email");
      }
      redirect("/login?account=unavailable");
    }
    throw error;
  }
});
