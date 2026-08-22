"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { AuthActionState } from "@/auth/action-state";
import type { AuthLocale } from "@/auth/validation";
import { authContent, localizedAuthPath } from "@/content/auth";

export function AuthStatusMessage({
  state,
  locale,
}: {
  state: AuthActionState;
  locale: AuthLocale;
}) {
  const messageRef = useRef<HTMLDivElement>(null);
  // Action-state identity is the per-response signal; status can stay ERROR.
  useEffect(() => {
    if (state.status === "ERROR") {
      messageRef.current?.focus();
    }
  }, [state]);

  if (!state.message) {
    return null;
  }

  const verificationHref =
    state.nextStep === "VERIFY_EMAIL"
      ? localizedAuthPath(locale, "/verify-email")
      : null;

  return (
    <div
      ref={messageRef}
      className={`auth-status auth-status--${state.status.toLowerCase()}`}
      role={state.status === "ERROR" ? "alert" : "status"}
      aria-live="polite"
      tabIndex={state.status === "ERROR" ? -1 : undefined}
    >
      <span>{state.message}</span>
      {verificationHref ? (
        <Link className="auth-status__action" href={verificationHref}>
          {authContent[locale].common.verifyEmailAction}
        </Link>
      ) : null}
    </div>
  );
}
