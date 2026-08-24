"use client";

import { useEffect, useRef } from "react";

export type ApplicationActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
};

export function ApplicationActionStatus({
  className,
  state,
}: {
  className?: string;
  state: ApplicationActionState;
}) {
  const statusRef = useRef<HTMLDivElement>(null);

  // Each action-state object represents one server response. Depending only on
  // the status string would miss a second, distinct ERROR response.
  useEffect(() => {
    if (state.status === "ERROR") {
      statusRef.current?.focus();
    }
  }, [state]);

  if (!state.message) return null;

  const classes = [
    "application-action-status",
    `application-action-status--${state.status.toLowerCase()}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={statusRef}
      className={classes}
      role={state.status === "ERROR" ? "alert" : "status"}
      aria-live="polite"
      aria-atomic="true"
      tabIndex={state.status === "ERROR" ? -1 : undefined}
    >
      {state.message}
    </div>
  );
}
