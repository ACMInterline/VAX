"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import {
  initialAdminActionState,
  type AdminActionState,
} from "@/modules/identity-access/admin-action-state";
import { AdminActionStatus } from "./admin-action-status";

type AdminServerAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function AdminConfirmationAction({
  action,
  cancelLabel,
  children,
  confirmLabel,
  description,
  disabled = false,
  fields,
  title,
}: {
  action: AdminServerAction;
  cancelLabel: string;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  fields: Readonly<Record<string, string>>;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAdminActionState,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (state.status === "SUCCESS" && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state]);

  function openDialog() {
    dialogRef.current?.showModal();
    queueMicrotask(() => cancelRef.current?.focus());
  }

  return (
    <div className="admin-confirmation-action">
      <button
        ref={triggerRef}
        className="admin-action-trigger"
        type="button"
        disabled={disabled}
        onClick={openDialog}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="admin-confirmation-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={() => triggerRef.current?.focus()}
      >
        <form action={formAction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-description`}>{description}</p>
          <AdminActionStatus state={state} />
          <div className="admin-dialog-actions">
            <button
              ref={cancelRef}
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              {cancelLabel}
            </button>
            <button type="submit" disabled={pending}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
