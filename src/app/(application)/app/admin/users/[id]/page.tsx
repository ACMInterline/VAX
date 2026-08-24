import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPrivilegedAuthenticationProvider } from "@/auth/neon-provider";
import { AdminConfirmationAction } from "@/components/admin/admin-confirmation-action";
import { adminContent } from "@/content/admin";
import { getDatabase } from "@/db/client";
import { loadAdminUserDetail } from "@/modules/identity-access/admin-repository";
import { deriveIdentityReconciliationStates } from "@/modules/identity-access/administration";
import { accountStatuses } from "@/modules/identity-access/authorization";
import { applicationRoleCodes } from "@/modules/identity-access/policy";
import { requireIdentityAdminPrincipal } from "../../admin-principal";
import {
  assignRoleAction,
  changeStatusAction,
  revokeRoleAction,
} from "../actions";

export const dynamic = "force-dynamic";

function dateLabel(locale: "bg" | "en", value: Date): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function reconciliationLabel(
  locale: "bg" | "en",
  state: ReturnType<typeof deriveIdentityReconciliationStates>[number],
): string {
  const labels = {
    bg: {
      ALIGNED: "Съгласувано",
      NO_IDENTITY_RECORD: "Липсва идентичност",
      PROVIDER_IDENTITY_WITHOUT_PROFILE: "Идентичност без приложен профил",
      PROFILE_WITHOUT_PROVIDER_IDENTITY: "Приложен профил без идентичност",
      PROFILE_WITHOUT_ACTIVE_ROLE: "Профил без активна роля",
      BLOCKED_PROFILE_WITH_ACTIVE_SESSIONS: "Блокиран профил с активни сесии",
      PROVIDER_STATE_UNKNOWN: "Непотвърдено състояние при доставчика",
    },
    en: {
      ALIGNED: "Aligned",
      NO_IDENTITY_RECORD: "No identity record",
      PROVIDER_IDENTITY_WITHOUT_PROFILE: "Provider identity without profile",
      PROFILE_WITHOUT_PROVIDER_IDENTITY: "Profile without provider identity",
      PROFILE_WITHOUT_ACTIVE_ROLE: "Profile without active role",
      BLOCKED_PROFILE_WITH_ACTIVE_SESSIONS: "Blocked profile with active sessions",
      PROVIDER_STATE_UNKNOWN: "Provider state unknown",
    },
  } as const;
  return labels[locale][state];
}

function auditLabel(
  labels: Record<string, string>,
  value: string,
): string {
  return labels[value] ?? value;
}

function auditMetadataValue(
  locale: "bg" | "en",
  key: string,
  value: string,
): string {
  const copy = adminContent[locale];
  if (
    key === "roleCode" &&
    (applicationRoleCodes as readonly string[]).includes(value)
  ) {
    return copy.roleLabels[value as (typeof applicationRoleCodes)[number]];
  }
  if (
    (key === "previousStatus" || key === "newStatus") &&
    (accountStatuses as readonly string[]).includes(value)
  ) {
    return copy.statusLabels[value as (typeof accountStatuses)[number]];
  }
  if (key === "source" && value === "PRIVILEGED_ADMINISTRATION") {
    return copy.detail.privilegedAdministration;
  }
  return value;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [principal, routeParams] = await Promise.all([
    requireIdentityAdminPrincipal(),
    params,
  ]);
  if (!z.uuid().safeParse(routeParams.id).success) notFound();

  const internalDetail = await loadAdminUserDetail(getDatabase(), routeParams.id);
  if (!internalDetail) notFound();
  const user = internalDetail.user;
  const locale = principal.profile.preferredLocale;
  const copy = adminContent[locale];
  const capabilities = getPrivilegedAuthenticationProvider().getCapabilities();
  const reconciliation = deriveIdentityReconciliationStates({
    providerIdentityState: "UNKNOWN",
    applicationProfile: {
      status: user.status,
      activeRoleCount: user.roles.length,
    },
    activeProviderSessionCount: null,
  });
  const isSelf = principal.profile.id === user.id;
  const actorIsOwner = principal.roles.has("OWNER");
  const actorIsAdmin = principal.roles.has("ADMIN");
  const targetIsPrivileged = user.roles.some(
    (role) => role === "OWNER" || role === "ADMIN",
  );
  const canManageTarget =
    !isSelf &&
    (actorIsOwner || (actorIsAdmin && !targetIsPrivileged));
  const canManageStatus =
    canManageTarget && principal.permissions.has("USER_ADMIN_MANAGE");
  const canManageRoles =
    canManageTarget &&
    principal.permissions.has("USER_ADMIN_MANAGE") &&
    principal.permissions.has("ROLE_ASSIGN");
  const canReadAudit = principal.permissions.has("AUDIT_READ");

  return (
    <article className="admin-page admin-user-detail" aria-labelledby="admin-user-title">
      <Link className="admin-back-link" href="/app/admin/users">
        {copy.backToUsers}
      </Link>
      <header className="admin-page-header">
        <p className="eyebrow">{copy.detail.eyebrow}</p>
        <h1 id="admin-user-title">{user.displayName}</h1>
        <span className={`admin-status admin-status--${user.status.toLowerCase()}`}>
          {copy.statusLabels[user.status]}
        </span>
      </header>

      <div className="admin-detail-grid">
        <section className="admin-detail-card" aria-labelledby="profile-heading">
          <h2 id="profile-heading">{copy.detail.profile}</h2>
          <dl>
            <div><dt>{copy.detail.displayName}</dt><dd>{user.displayName}</dd></div>
            <div><dt>{copy.detail.locale}</dt><dd>{user.preferredLocale.toUpperCase()}</dd></div>
            <div><dt>{copy.detail.phone}</dt><dd>{user.phone ?? "—"}</dd></div>
            <div>
              <dt>{copy.detail.created}</dt>
              <dd><time dateTime={user.createdAt.toISOString()}>{dateLabel(locale, user.createdAt)}</time></dd>
            </div>
          </dl>
        </section>

        <section className="admin-detail-card" aria-labelledby="provider-heading">
          <h2 id="provider-heading">{copy.detail.provider}</h2>
          <p>{copy.detail.providerUnknown}</p>
          <ul className="admin-reconciliation-list">
            {reconciliation.map((state) => (
              <li key={state}>{reconciliationLabel(locale, state)}</li>
            ))}
          </ul>
          <p className="admin-capability-state">
            {copy.detail.providerUserListing}:{" "}
            {capabilities.listUsers.availability === "SUPPORTED"
              ? copy.detail.supported
              : copy.detail.unavailableCapability}
          </p>
        </section>

        <section className="admin-detail-card" aria-labelledby="session-heading">
          <h2 id="session-heading">{copy.detail.sessions}</h2>
          <p>{copy.detail.sessionUnavailable}</p>
          <p className="admin-capability-state">
            {copy.detail.sessionListing}: {copy.detail.unavailableCapability} ·{" "}
            {copy.detail.revokeAllSessions}: {copy.detail.unavailableCapability}
          </p>
        </section>

        <section className="admin-detail-card admin-detail-card--wide" aria-labelledby="status-heading">
          <h2 id="status-heading">{copy.detail.status}</h2>
          <div className="admin-action-row">
            {accountStatuses
              .filter((status) => status !== user.status)
              .map((status) => {
                const highRiskBlocked = status === "DISABLED";
                return (
                  <AdminConfirmationAction
                    key={status}
                    action={changeStatusAction}
                    cancelLabel={copy.cancel}
                    confirmLabel={copy.confirm}
                    description={copy.detail.statusBody}
                    disabled={!canManageStatus || highRiskBlocked}
                    fields={{ targetProfileId: user.id, status }}
                    title={copy.detail.confirmationTitle}
                  >
                    {status === "ACTIVE"
                      ? copy.detail.reactivate
                      : status === "SUSPENDED"
                        ? copy.detail.suspend
                        : copy.detail.disable}
                  </AdminConfirmationAction>
                );
              })}
          </div>
          <p className="admin-gate-note">{copy.detail.highRiskGate}</p>
        </section>

        <section className="admin-detail-card admin-detail-card--wide" aria-labelledby="roles-heading">
          <h2 id="roles-heading">{copy.detail.roles}</h2>
          {user.roleAssignments.length === 0 ? (
            <p>{copy.detail.noRoles}</p>
          ) : (
            <ul className="admin-role-history">
              {user.roleAssignments.map((assignment) => (
                <li key={assignment.role}>
                  <div>
                    <strong>{copy.roleLabels[assignment.role]}</strong>
                    <span>{assignment.active ? copy.detail.current : copy.detail.historical}</span>
                  </div>
                  <small>
                    {copy.detail.assigned}: {dateLabel(locale, assignment.assignedAt)}
                    {assignment.revokedAt
                      ? ` · ${copy.detail.revoked}: ${dateLabel(locale, assignment.revokedAt)}`
                      : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}

          <div className="admin-role-controls">
            {applicationRoleCodes.map((roleCode) => {
              const assigned = user.roles.includes(roleCode);
              const highRiskBlocked = roleCode === "OWNER" || roleCode === "ADMIN";
              return (
                <AdminConfirmationAction
                  key={roleCode}
                  action={assigned ? revokeRoleAction : assignRoleAction}
                  cancelLabel={copy.cancel}
                  confirmLabel={copy.confirm}
                  description={copy.detail.confirmationBody}
                  disabled={!canManageRoles || highRiskBlocked}
                  fields={{ targetProfileId: user.id, roleCode }}
                  title={copy.detail.confirmationTitle}
                >
                  {assigned ? copy.detail.revokeRole : copy.detail.assignRole}: {copy.roleLabels[roleCode]}
                </AdminConfirmationAction>
              );
            })}
          </div>
          <p className="admin-gate-note">{copy.detail.highRiskGate}</p>
        </section>

        {canReadAudit ? (
          <section className="admin-detail-card admin-detail-card--wide" aria-labelledby="audit-heading">
            <h2 id="audit-heading">{copy.detail.audit}</h2>
            {user.auditEvents.length === 0 ? (
              <p>{copy.detail.noAudit}</p>
            ) : (
              <ol className="admin-audit-list">
                {user.auditEvents.map((event) => (
                  <li key={event.id}>
                    <div>
                      <strong>
                        {auditLabel(copy.detail.auditEventLabels, event.eventType)}
                      </strong>
                      <span>
                        {auditLabel(copy.detail.auditOutcomeLabels, event.outcome)}
                      </span>
                    </div>
                    <time dateTime={event.occurredAt.toISOString()}>{dateLabel(locale, event.occurredAt)}</time>
                    {Object.keys(event.safeMetadata).length > 0 ? (
                      <dl>
                        {Object.entries(event.safeMetadata).map(([key, value]) => (
                          <div key={key}>
                            <dt>
                              {auditLabel(copy.detail.auditMetadataLabels, key)}
                            </dt>
                            <dd>{auditMetadataValue(locale, key, value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}
      </div>
    </article>
  );
}
