"use client";

import { useEffect, useRef } from "react";
import type { AdminActionState } from "@/modules/identity-access/admin-action-state";

export function AdminActionStatus({ state }: { state: AdminActionState }) {
  const statusRef = useRef<HTMLDivElement>(null);

  // The action-state object identifies one server response. Depending on the
  // status string alone would miss a second, distinct ERROR response.
  useEffect(() => {
    if (state.status === "ERROR") {
      statusRef.current?.focus();
    }
  }, [state]);

  if (!state.message) return null;

  return (
    <div
      ref={statusRef}
      className={`admin-action-status admin-action-status--${state.status.toLowerCase()}`}
      role={state.status === "ERROR" ? "alert" : "status"}
      aria-live="polite"
      tabIndex={state.status === "ERROR" ? -1 : undefined}
    >
      {state.message}
    </div>
  );
}
