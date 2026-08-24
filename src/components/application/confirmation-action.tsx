"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import {
  ApplicationActionStatus,
  type ApplicationActionState,
} from "./action-status";

export type { ApplicationActionState } from "./action-status";

type ApplicationServerAction = (
  state: ApplicationActionState,
  formData: FormData,
) => ApplicationActionState | Promise<ApplicationActionState>;

export function ApplicationConfirmationAction({
  action,
  cancelLabel,
  children,
  confirmLabel,
  description,
  disabled = false,
  fields,
  initialState,
  pendingLabel,
  title,
  variant = "default",
}: {
  action: ApplicationServerAction;
  cancelLabel: string;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  fields: Readonly<Record<string, string>>;
  initialState: ApplicationActionState;
  pendingLabel?: string;
  title: string;
  variant?: "default" | "danger";
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialState,
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

  const classes = [
    "application-confirmation-action",
    `application-confirmation-action--${variant}`,
  ].join(" ");

  return (
    <div className={classes}>
      <button
        ref={triggerRef}
        className="application-confirmation-action__trigger"
        type="button"
        disabled={disabled}
        onClick={openDialog}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="application-confirmation-action__dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={() => triggerRef.current?.focus()}
      >
        <form action={formAction} aria-busy={pending}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-description`}>{description}</p>
          <ApplicationActionStatus state={state} />
          <div className="application-confirmation-action__buttons">
            <button
              ref={cancelRef}
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              {cancelLabel}
            </button>
            <button type="submit" disabled={pending}>
              {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
