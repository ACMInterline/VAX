"use client";

import { useActionState } from "react";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationActionStatus } from "@/components/application/action-status";
import { ApplicationConfirmationAction } from "@/components/application/confirmation-action";
import { businessAuthorityContent } from "@/content/business-authority";
import type { AuthorityType } from "@/modules/business-authority/types";
import { transitionAuthorityAction } from "./actions";

const initialState = { status: "IDLE" as const };

export function AuthorityRecordActions({
  locale,
  outstandingAuthorityTypes,
  recordId,
  authorityVersion,
  recordVersion,
  contentHash,
  status,
}: {
  locale: AuthLocale;
  outstandingAuthorityTypes: readonly AuthorityType[];
  recordId: string;
  authorityVersion: number;
  recordVersion: number;
  contentHash: string;
  status: "PROPOSED" | "UNDER_REVIEW";
}) {
  const copy = businessAuthorityContent[locale];
  const [approvalState, approvalAction, approvalPending] = useActionState(
    transitionAuthorityAction,
    initialState,
  );
  const sharedFields = {
    recordId,
    expectedAuthorityVersion: String(authorityVersion),
    expectedRecordVersion: String(recordVersion),
    expectedContentHash: contentHash,
    decisionAuthorityType: "",
    evidenceReference: "",
    safeEvidenceSummary: "",
  };

  return (
    <div className="business-authority-record-actions business-authority-screen-only">
      {status === "PROPOSED" ? (
        <ApplicationConfirmationAction
          action={transitionAuthorityAction}
          cancelLabel={copy.actions.cancel}
          confirmLabel={copy.actions.confirm}
          description={copy.actions.submitDescription}
          fields={{
            ...sharedFields,
            action: "SUBMIT_FOR_REVIEW",
          }}
          initialState={initialState}
          pendingLabel={copy.actions.pending}
          title={copy.actions.confirmationTitle}
        >
          {copy.actions.submit}
        </ApplicationConfirmationAction>
      ) : null}

      {status === "UNDER_REVIEW" && outstandingAuthorityTypes.length > 0 ? (
        <form
          className="business-authority-approval-form"
          action={approvalAction}
          aria-busy={approvalPending}
        >
          <input type="hidden" name="recordId" value={recordId} />
          <input
            type="hidden"
            name="expectedAuthorityVersion"
            value={authorityVersion}
          />
          <input
            type="hidden"
            name="expectedRecordVersion"
            value={recordVersion}
          />
          <input type="hidden" name="expectedContentHash" value={contentHash} />
          <input type="hidden" name="action" value="APPROVE" />
          <label>
            <span>{copy.actions.decisionAuthority}</span>
            <select name="decisionAuthorityType" required>
              {outstandingAuthorityTypes.map((authorityType) => (
                <option key={authorityType} value={authorityType}>
                  {copy.authorityTypes[authorityType]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.actions.evidenceReference}</span>
            <input name="evidenceReference" type="text" maxLength={500} />
          </label>
          <label className="business-authority-approval-form__wide">
            <span>{copy.actions.evidenceSummary}</span>
            <textarea name="safeEvidenceSummary" rows={3} maxLength={2_000} />
          </label>
          <ApplicationActionStatus
            className="business-authority-approval-form__wide"
            state={approvalState}
          />
          <button
            className="crm-button business-authority-approval-form__wide"
            type="submit"
            disabled={approvalPending}
          >
            {approvalPending ? copy.actions.pending : copy.actions.approve}
          </button>
        </form>
      ) : null}

      <ApplicationConfirmationAction
        action={transitionAuthorityAction}
        cancelLabel={copy.actions.cancel}
        confirmLabel={copy.actions.confirm}
        description={copy.actions.rejectDescription}
        fields={{ ...sharedFields, action: "REJECT" }}
        initialState={initialState}
        pendingLabel={copy.actions.pending}
        title={copy.actions.confirmationTitle}
        variant="danger"
      >
        {copy.actions.reject}
      </ApplicationConfirmationAction>
    </div>
  );
}
