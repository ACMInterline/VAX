"use client";

import { useActionState, useMemo, useState } from "react";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationActionStatus } from "@/components/application/action-status";
import { businessAuthorityContent } from "@/content/business-authority";
import type {
  AuthorityCategory,
  AuthorityEvidenceClass,
  AuthorityValueKind,
} from "@/modules/business-authority/types";
import { createAuthorityProposalAction } from "./actions";

export type AuthorityProposalOption = Readonly<{
  key: string;
  category: AuthorityCategory;
  label: string;
  description: string;
  evidenceClass: AuthorityEvidenceClass;
  allowedValueKinds: readonly AuthorityValueKind[];
}>;

const initialState = { status: "IDLE" as const };

export function AuthorityProposalForm({
  definitions,
  locale,
}: {
  definitions: readonly AuthorityProposalOption[];
  locale: AuthLocale;
}) {
  const copy = businessAuthorityContent[locale];
  const [state, formAction, pending] = useActionState(
    createAuthorityProposalAction,
    initialState,
  );
  const [selectedKey, setSelectedKey] = useState(definitions[0]?.key ?? "");
  const selected = useMemo(
    () => definitions.find((entry) => entry.key === selectedKey),
    [definitions, selectedKey],
  );
  const categories = [...new Set(definitions.map((entry) => entry.category))];

  return (
    <section
      className="business-authority-proposal business-authority-screen-only"
      aria-labelledby="business-authority-proposal-title"
    >
      <header>
        <h2 id="business-authority-proposal-title">{copy.proposal.title}</h2>
        <p>{copy.proposal.intro}</p>
        <p className="business-authority-privileged-note">
          {copy.proposal.privileged}
        </p>
      </header>

      <form action={formAction} aria-busy={pending}>
        <label>
          <span>{copy.proposal.authority}</span>
          <select
            name="authorityKey"
            required
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.currentTarget.value)}
          >
            {categories.map((category) => (
              <optgroup key={category} label={copy.categories[category]}>
                {definitions
                  .filter((entry) => entry.category === category)
                  .map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {selected ? (
            <small>
              {selected.description} {copy.evidenceClass}: {copy.evidence[selected.evidenceClass]}.
            </small>
          ) : null}
        </label>

        <label>
          <span>{copy.proposal.environment}</span>
          <select name="environmentScope" defaultValue="STAGING" required>
            <option value="STAGING">{copy.environments.STAGING}</option>
            <option value="PRODUCTION">{copy.environments.PRODUCTION}</option>
          </select>
        </label>

        <label className="business-authority-proposal__wide">
          <span>{copy.proposal.value}</span>
          <textarea
            name="valueJson"
            rows={9}
            required
            maxLength={16_384}
            spellCheck={false}
            aria-describedby="business-authority-value-help"
          />
          <small id="business-authority-value-help">
            {copy.proposal.valueHelp}
            {selected
              ? ` ${selected.allowedValueKinds.join(", ")}.`
              : null}
          </small>
        </label>

        <label className="business-authority-proposal__wide">
          <span>{copy.proposal.sourceReference}</span>
          <input name="sourceReference" type="text" maxLength={500} />
          <small>{copy.proposal.sourceHelp}</small>
        </label>

        <label>
          <span>{copy.proposal.evidenceSummary}</span>
          <textarea name="safeEvidenceSummary" rows={4} maxLength={2_000} />
        </label>
        <label>
          <span>{copy.proposal.internalNotes}</span>
          <textarea name="internalNotes" rows={4} maxLength={4_000} />
        </label>

        <label>
          <span>{copy.proposal.effectiveFrom}</span>
          <input
            name="effectiveFrom"
            type="text"
            inputMode="text"
            placeholder="2026-09-01T00:00:00.000Z"
            maxLength={40}
            required
          />
        </label>
        <label>
          <span>{copy.proposal.effectiveUntil}</span>
          <input
            name="effectiveUntil"
            type="text"
            inputMode="text"
            placeholder="2027-09-01T00:00:00.000Z"
            maxLength={40}
          />
        </label>

        <ApplicationActionStatus
          className="business-authority-proposal__wide"
          state={state}
        />
        <button
          className="crm-button business-authority-proposal__wide"
          type="submit"
          disabled={pending || definitions.length === 0}
        >
          {pending ? copy.proposal.pending : copy.proposal.submit}
        </button>
      </form>
    </section>
  );
}
