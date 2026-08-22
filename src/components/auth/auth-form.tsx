"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/auth/action-state";
import type { AuthLocale } from "@/auth/validation";
import {
  forgotPasswordAction,
  loginAction,
  requestEmailVerificationAction,
  resetPasswordAction,
  signupAction,
  verifyEmailAction,
} from "@/app/auth-actions";
import { authContent } from "@/content/auth";
import { AuthStatusMessage } from "./auth-status-message";

type StandardFormKind = "login" | "signup" | "forgot-password" | "reset-password";
const initialAuthActionState: AuthActionState = { status: "IDLE" };

function SubmitButton({ idleLabel, workingLabel }: { idleLabel: string; workingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="auth-submit" type="submit" disabled={pending}>
      {pending ? workingLabel : idleLabel}
    </button>
  );
}

function FieldError({
  state,
  name,
  id = `${name}-error`,
}: {
  state: AuthActionState;
  name: string;
  id?: string;
}) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? (
    <p className="field-error" id={id}>
      {message}
    </p>
  ) : null;
}

function invalid(state: AuthActionState, name: string): boolean {
  return Boolean(state.fieldErrors?.[name]);
}

const actions = {
  login: loginAction,
  signup: signupAction,
  "forgot-password": forgotPasswordAction,
  "reset-password": resetPasswordAction,
} as const;

export function AuthForm({
  kind,
  locale,
  resetToken,
}: {
  kind: StandardFormKind;
  locale: AuthLocale;
  resetToken?: string;
}) {
  const [state, formAction] = useActionState(actions[kind], initialAuthActionState);
  const content = authContent[locale];
  const kindContent =
    kind === "forgot-password"
      ? content.forgot
      : kind === "reset-password"
        ? content.reset
        : content[kind];

  return (
    <form action={formAction} className="auth-form" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {kind === "reset-password" ? (
        <input type="hidden" name="token" value={resetToken ?? ""} />
      ) : null}
      <AuthStatusMessage state={state} locale={locale} />

      {kind === "signup" ? (
        <div className="field-group">
          <label htmlFor="displayName">{content.common.displayName}</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            maxLength={160}
            aria-invalid={invalid(state, "displayName")}
            aria-describedby={invalid(state, "displayName") ? "displayName-error" : undefined}
          />
          <FieldError state={state} name="displayName" />
        </div>
      ) : null}

      {kind !== "reset-password" ? (
        <div className="field-group">
          <label htmlFor={`${kind}-email`}>{content.common.email}</label>
          <input
            id={`${kind}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={invalid(state, "email")}
            aria-describedby={invalid(state, "email") ? "email-error" : undefined}
          />
          <FieldError state={state} name="email" />
        </div>
      ) : null}

      {kind === "login" ? (
        <div className="field-group">
          <label htmlFor="login-password">{content.common.password}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            aria-invalid={invalid(state, "password")}
            aria-describedby={invalid(state, "password") ? "password-error" : undefined}
          />
          <FieldError state={state} name="password" />
        </div>
      ) : null}

      {kind === "signup" || kind === "reset-password" ? (
        <>
          <div className="field-group">
            <label htmlFor={`${kind}-password`}>{content.common.password}</label>
            <input
              id={`${kind}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              aria-invalid={invalid(state, "password")}
              aria-describedby={`password-hint${invalid(state, "password") ? " password-error" : ""}`}
            />
            <p className="field-hint" id="password-hint">{content.common.passwordHint}</p>
            <FieldError state={state} name="password" />
          </div>
          <div className="field-group">
            <label htmlFor={`${kind}-password-confirmation`}>
              {content.common.passwordConfirmation}
            </label>
            <input
              id={`${kind}-password-confirmation`}
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              aria-invalid={invalid(state, "passwordConfirmation")}
              aria-describedby={
                invalid(state, "passwordConfirmation")
                  ? "passwordConfirmation-error"
                  : undefined
              }
            />
            <FieldError state={state} name="passwordConfirmation" />
          </div>
        </>
      ) : null}

      {kind === "signup" ? (
        <>
          <input type="hidden" name="preferredLocale" value={locale} />
          <label className="auth-checkbox">
            <input
              name="termsAccepted"
              type="checkbox"
              required
              aria-invalid={invalid(state, "termsAccepted")}
              aria-describedby={
                invalid(state, "termsAccepted")
                  ? "termsAccepted-error"
                  : undefined
              }
            />
            <span>{content.signup.terms}</span>
          </label>
          <FieldError state={state} name="termsAccepted" />
        </>
      ) : null}

      <SubmitButton idleLabel={kindContent.submit} workingLabel={content.common.working} />
    </form>
  );
}

function VerificationRequestForm({ locale }: { locale: AuthLocale }) {
  const [state, formAction] = useActionState(
    requestEmailVerificationAction,
    initialAuthActionState,
  );
  const content = authContent[locale];
  return (
    <form action={formAction} className="auth-form auth-form--secondary" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <AuthStatusMessage state={state} locale={locale} />
      <div className="field-group">
        <label htmlFor="verification-request-email">{content.common.email}</label>
        <input
          id="verification-request-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={invalid(state, "email")}
          aria-describedby={
            invalid(state, "email")
              ? "verification-request-email-error"
              : undefined
          }
        />
        <FieldError
          state={state}
          name="email"
          id="verification-request-email-error"
        />
      </div>
      <SubmitButton idleLabel={content.verify.resend} workingLabel={content.common.working} />
    </form>
  );
}

function VerificationCodeForm({ locale }: { locale: AuthLocale }) {
  const [state, formAction] = useActionState(verifyEmailAction, initialAuthActionState);
  const content = authContent[locale];
  return (
    <form action={formAction} className="auth-form" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <AuthStatusMessage state={state} locale={locale} />
      <div className="field-group">
        <label htmlFor="verification-email">{content.common.email}</label>
        <input
          id="verification-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={invalid(state, "email")}
          aria-describedby={
            invalid(state, "email") ? "verification-email-error" : undefined
          }
        />
        <FieldError state={state} name="email" id="verification-email-error" />
      </div>
      <div className="field-group">
        <label htmlFor="verification-otp">{content.verify.otp}</label>
        <input
          id="verification-otp"
          name="otp"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          aria-invalid={invalid(state, "otp")}
          aria-describedby={
            invalid(state, "otp") ? "verification-otp-error" : undefined
          }
        />
        <FieldError state={state} name="otp" id="verification-otp-error" />
      </div>
      <SubmitButton idleLabel={content.verify.submit} workingLabel={content.common.working} />
    </form>
  );
}

export function EmailVerificationForms({ locale }: { locale: AuthLocale }) {
  return (
    <div className="auth-verification-forms">
      <VerificationCodeForm locale={locale} />
      <VerificationRequestForm locale={locale} />
    </div>
  );
}
