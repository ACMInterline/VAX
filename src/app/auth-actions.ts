"use server";

import { redirect } from "next/navigation";
import {
  withVerificationNextStep,
  type AuthActionState,
} from "@/auth/action-state";
import { getAuthenticationProvider } from "@/auth/neon-provider";
import { getAuthRuntimeConfiguration } from "@/auth/config";
import { requestCustomerRegistration } from "@/auth/customer-registration";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import {
  authLocale,
  emailVerificationRequestSchema,
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type AuthLocale,
} from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  loadApplicationAccess,
  provisionCustomerProfile,
  recordAuthAuditEvent,
  type ApplicationAccess,
} from "@/modules/identity-access/repository";
import { getConfiguredPublicUrl } from "@/lib/public-metadata";

export type { AuthActionState } from "@/auth/action-state";

const copy = {
  bg: {
    invalid: "Проверете въведените данни и опитайте отново.",
    invalidCredentials: "Невалиден имейл или парола.",
    unavailable: "Услугата временно не е достъпна. Опитайте отново по-късно.",
    accountUnavailable: "Този профил в момента няма достъп до приложението.",
    verifyRequired: "Потвърдете имейл адреса си, преди да продължите.",
    resetRequested:
      "Ако съществува профил с този имейл, ще получите инструкции за възстановяване.",
    resetInvalid: "Връзката е невалидна или е изтекла. Заявете нова.",
    verificationRequested:
      "Ако адресът може да бъде потвърден, ще получите код за потвърждение.",
    verificationInvalid: "Кодът е невалиден или е изтекъл.",
    signupRequested:
      "Заявката за регистрация е приета. Ако профилът е създаден, можете да влезете; при необходимост следвайте изпратените инструкции.",
  },
  en: {
    invalid: "Check the entered information and try again.",
    invalidCredentials: "Invalid email or password.",
    unavailable: "The service is temporarily unavailable. Please try again later.",
    accountUnavailable: "This account cannot access the application right now.",
    verifyRequired: "Verify your email address before continuing.",
    resetRequested:
      "If an account exists for this email, recovery instructions will be sent.",
    resetInvalid: "This link is invalid or has expired. Request a new one.",
    verificationRequested:
      "If the address can be verified, a verification code will be sent.",
    verificationInvalid: "The code is invalid or has expired.",
    signupRequested:
      "The registration request was accepted. If the account was created, you can sign in; follow any verification instructions sent to you.",
  },
} as const;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function invalidState(
  locale: AuthLocale,
  issues: readonly { path: PropertyKey[] }[],
): AuthActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] = [copy[locale].invalid];
  }
  return { status: "ERROR", message: copy[locale].invalid, fieldErrors };
}

async function safeAudit(
  input: Parameters<typeof recordAuthAuditEvent>[1],
): Promise<void> {
  try {
    await recordAuthAuditEvent(getDatabase(), input);
  } catch {
    // Authentication responses must never expose database or provider details.
  }
}

async function ensureApplicationAccess(
  providerUser: { id: string; displayName: string },
  locale: AuthLocale,
): Promise<ApplicationAccess> {
  const database = getDatabase();
  const existing = await loadApplicationAccess(database, providerUser.id);
  if (existing) {
    return existing;
  }

  await provisionCustomerProfile(database, {
    authProviderUserId: providerUser.id,
    displayName: providerUser.displayName,
    preferredLocale: locale,
  });
  const provisioned = await loadApplicationAccess(database, providerUser.id);
  if (!provisioned) {
    throw new Error("Application access provisioning failed.");
  }
  return provisioned;
}

function fixedPath(locale: AuthLocale, path: string): string {
  return locale === "en" ? `/en${path}` : path;
}

function passwordResetCallback(locale: AuthLocale): string {
  const configuredUrl = getConfiguredPublicUrl();
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("A public application URL is required for password reset.");
  }
  return new URL(
    fixedPath(locale, "/reset-password"),
    configuredUrl ?? new URL("http://localhost:3000"),
  ).toString();
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }
  if (!(await isAuthAttemptAllowed("LOGIN", result.data.email))) {
    return { status: "ERROR", message: copy[locale].unavailable };
  }

  const provider = getAuthenticationProvider();
  let signedInUser;
  try {
    signedInUser = await provider.signIn(result.data);
  } catch {
    await safeAudit({
      eventType: "LOGIN_FAILED",
      outcome: "FAILURE",
      safeMetadata: { reasonCode: "CREDENTIALS_REJECTED" },
    });
    return { status: "ERROR", message: copy[locale].invalidCredentials };
  }

  let access: ApplicationAccess;
  if (
    getAuthRuntimeConfiguration().requireVerifiedEmail &&
    !signedInUser.emailVerified
  ) {
    await safeAudit({
      eventType: "LOGIN_FAILED",
      outcome: "DENIED",
      safeMetadata: { reasonCode: "EMAIL_UNVERIFIED" },
    });
    await provider.signOut().catch(() => undefined);
    return withVerificationNextStep(
      { status: "ERROR", message: copy[locale].verifyRequired },
      true,
    );
  }

  try {
    access = await ensureApplicationAccess(signedInUser, locale);
  } catch {
    await provider.signOut().catch(() => undefined);
    return { status: "ERROR", message: copy[locale].unavailable };
  }

  if (access.profile.status !== "ACTIVE" || access.roles.size === 0) {
    await safeAudit({
      eventType: "LOGIN_FAILED",
      outcome: "DENIED",
      actorProfileId: access.profile.id,
      subjectProfileId: access.profile.id,
      safeMetadata: { reasonCode: "ACCOUNT_UNAVAILABLE" },
    });
    await provider.signOut().catch(() => undefined);
    return { status: "ERROR", message: copy[locale].accountUnavailable };
  }
  await safeAudit({
    eventType: "LOGIN_SUCCEEDED",
    outcome: "SUCCESS",
    actorProfileId: access.profile.id,
    subjectProfileId: access.profile.id,
  });
  redirect("/app");
}

export async function signupAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = signupSchema.safeParse({
    displayName: formString(formData, "displayName"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    passwordConfirmation: formString(formData, "passwordConfirmation"),
    preferredLocale: formString(formData, "preferredLocale"),
    termsAccepted: formString(formData, "termsAccepted"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }
  if (!(await isAuthAttemptAllowed("SIGNUP", result.data.email))) {
    return { status: "ERROR", message: copy[locale].unavailable };
  }

  const provider = getAuthenticationProvider();
  const requireVerifiedEmail =
    getAuthRuntimeConfiguration().requireVerifiedEmail;
  await requestCustomerRegistration({
    provider,
    registration: {
      displayName: result.data.displayName,
      email: result.data.email,
      password: result.data.password,
    },
    requireVerifiedEmail,
  });
  return withVerificationNextStep(
    { status: "SUCCESS", message: copy[locale].signupRequested },
    requireVerifiedEmail,
  );
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = forgotPasswordSchema.safeParse({
    email: formString(formData, "email"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }

  if (await isAuthAttemptAllowed("PASSWORD_RESET", result.data.email)) {
    try {
      await getAuthenticationProvider().requestPasswordReset(
        result.data.email,
        passwordResetCallback(locale),
      );
      await safeAudit({
        eventType: "PASSWORD_RESET_REQUESTED",
        outcome: "SUCCESS",
      });
    } catch {
      // The same response is returned for unknown accounts and provider failures.
    }
  }

  return { status: "SUCCESS", message: copy[locale].resetRequested };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = resetPasswordSchema.safeParse({
    token: formString(formData, "token"),
    password: formString(formData, "password"),
    passwordConfirmation: formString(formData, "passwordConfirmation"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }
  if (!(await isAuthAttemptAllowed("PASSWORD_RESET", result.data.token))) {
    return { status: "ERROR", message: copy[locale].resetInvalid };
  }

  try {
    await getAuthenticationProvider().resetPassword(
      result.data.token,
      result.data.password,
    );
    await safeAudit({
      eventType: "PASSWORD_RESET_COMPLETED",
      outcome: "SUCCESS",
    });
  } catch {
    return { status: "ERROR", message: copy[locale].resetInvalid };
  }

  redirect(`${fixedPath(locale, "/login")}?reset=complete`);
}

export async function requestEmailVerificationAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = emailVerificationRequestSchema.safeParse({
    email: formString(formData, "email"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }

  if (await isAuthAttemptAllowed("EMAIL_VERIFICATION", result.data.email)) {
    try {
      await getAuthenticationProvider().requestEmailVerification(result.data.email);
      await safeAudit({
        eventType: "EMAIL_VERIFICATION_REQUESTED",
        outcome: "SUCCESS",
      });
    } catch {
      // Preserve a generic response and do not disclose account existence.
    }
  }
  return { status: "SUCCESS", message: copy[locale].verificationRequested };
}

export async function verifyEmailAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = authLocale(formData.get("locale"));
  const result = emailVerificationSchema.safeParse({
    email: formString(formData, "email"),
    otp: formString(formData, "otp"),
  });
  if (!result.success) {
    return invalidState(locale, result.error.issues);
  }
  if (!(await isAuthAttemptAllowed("EMAIL_VERIFICATION", result.data.email))) {
    return { status: "ERROR", message: copy[locale].verificationInvalid };
  }

  try {
    await getAuthenticationProvider().verifyEmail(result.data.email, result.data.otp);
    await safeAudit({ eventType: "EMAIL_VERIFIED", outcome: "SUCCESS" });
  } catch {
    return { status: "ERROR", message: copy[locale].verificationInvalid };
  }

  redirect(`${fixedPath(locale, "/login")}?verified=complete`);
}

export async function logoutAction(): Promise<void> {
  const provider = getAuthenticationProvider();
  const session = await provider.getSession();
  const access = session
    ? await loadApplicationAccess(getDatabase(), session.user.id).catch(() => null)
    : null;
  await provider.signOut();
  if (access) {
    await safeAudit({
      eventType: "LOGOUT_SUCCEEDED",
      outcome: "SUCCESS",
      actorProfileId: access.profile.id,
      subjectProfileId: access.profile.id,
    });
  }
  redirect("/login?logout=complete");
}
