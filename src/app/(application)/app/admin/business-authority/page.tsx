import { businessAuthorityContent } from "@/content/business-authority";
import { getDatabase } from "@/db/client";
import { businessAuthorityDefinitions } from "@/modules/business-authority/registry";
import { createDatabaseBusinessAuthorityRepository } from "@/modules/business-authority/repository";
import { evaluateProductionReadiness } from "@/modules/business-authority/readiness";
import { createBusinessAuthorityService } from "@/modules/business-authority/service";
import {
  authorityCategories,
  type AuthorityType,
} from "@/modules/business-authority/types";
import { requireBusinessAuthorityPrincipal } from "../admin-principal";
import {
  AuthorityProposalForm,
  type AuthorityProposalOption,
} from "./authority-proposal-form";
import { AuthorityPrintButton } from "./authority-print-button";
import {
  AuthorityPackageSummary,
  AuthorityVersionHistory,
  dateLabel,
  projectAuthorityRecordForPresentation,
} from "./authority-record-presentation";

export const dynamic = "force-dynamic";

export default async function BusinessAuthorityPage() {
  const principal = await requireBusinessAuthorityPrincipal();
  const locale = principal.profile.preferredLocale;
  const copy = businessAuthorityContent[locale];
  const actor = {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  } as const;
  const service = createBusinessAuthorityService(
    createDatabaseBusinessAuthorityRepository(getDatabase()),
  );
  const state = await service.listState(actor);
  const staging = evaluateProductionReadiness(state.records, {
    environmentScope: "STAGING",
    approvalEvents: state.events,
    configurationReferences: state.configurationReferences,
  });
  const production = evaluateProductionReadiness(state.records, {
    environmentScope: "PRODUCTION",
    approvalEvents: state.events,
    configurationReferences: state.configurationReferences,
  });
  const approvalsByRecord = new Map<string, Set<AuthorityType>>();
  for (const event of state.events) {
    if (
      (event.eventType !== "AUTHORITY_APPROVAL_RECORDED" &&
        event.eventType !== "AUTHORITY_APPROVED") ||
      event.decisionAuthorityType === null
    ) {
      continue;
    }
    const approvals =
      approvalsByRecord.get(event.authorityRecordId) ?? new Set();
    approvals.add(event.decisionAuthorityType);
    approvalsByRecord.set(event.authorityRecordId, approvals);
  }
  const productionItems = new Map(
    [...production.approvedItems, ...production.pendingItems].map((item) => [
      item.authorityKey,
      item,
    ]),
  );
  const stagingItems = new Map(
    [...staging.approvedItems, ...staging.pendingItems].map((item) => [
      item.authorityKey,
      item,
    ]),
  );
  const canControl =
    actor.roles.has("OWNER") && actor.permissions.has("SYSTEM_SETTINGS_MANAGE");
  const presentationRecords = state.records.map(
    projectAuthorityRecordForPresentation,
  );
  const options: readonly AuthorityProposalOption[] =
    businessAuthorityDefinitions
      .filter((definition) => definition.evidenceClass !== "SYSTEM_VERIFIED")
      .map((definition) => ({
        key: definition.key,
        category: definition.category,
        label: locale === "en" ? definition.labelEn : definition.labelBg,
        description:
          locale === "en" ? definition.descriptionEn : definition.descriptionBg,
        evidenceClass: definition.evidenceClass,
        allowedValueKinds: definition.allowedValueKinds,
      }));
  const generatedAt = production.generatedAt;

  return (
    <section
      className="admin-page business-authority-page"
      aria-labelledby="business-authority-title"
    >
      <header className="admin-page-header business-authority-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="business-authority-title">{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <AuthorityPrintButton label={copy.print} />
      </header>

      <aside
        className={`business-authority-access-note business-authority-access-note--${canControl ? "owner" : "readonly"}`}
        aria-label={canControl ? copy.ownerNotice : copy.adminReadOnly}
      >
        {canControl ? copy.ownerNotice : copy.adminReadOnly}
      </aside>

      <section
        className="business-authority-readiness"
        aria-labelledby="business-authority-readiness-title"
      >
        <header>
          <h2 id="business-authority-readiness-title">{copy.readiness}</h2>
          <p>{copy.readinessIntro}</p>
          <p>
            {copy.generated}:{" "}
            <time dateTime={generatedAt.toISOString()}>
              {dateLabel(locale, generatedAt)}
            </time>
          </p>
        </header>
        <div className="business-authority-packages">
          <AuthorityPackageSummary
            approvalsByRecord={approvalsByRecord}
            locale={locale}
            records={presentationRecords}
            report={staging}
          />
          <AuthorityPackageSummary
            approvalsByRecord={approvalsByRecord}
            locale={locale}
            records={presentationRecords}
            report={production}
          />
        </div>
      </section>

      {canControl ? (
        <AuthorityProposalForm locale={locale} definitions={options} />
      ) : null}

      <section
        className="business-authority-registry"
        aria-labelledby="business-authority-registry-title"
      >
        <header>
          <h2 id="business-authority-registry-title">{copy.registry}</h2>
          <p>{copy.registryIntro}</p>
        </header>

        <div className="business-authority-category-grid">
          {authorityCategories.map((category) => {
            const definitions = businessAuthorityDefinitions.filter(
              (definition) => definition.category === category,
            );
            return (
              <article
                className="business-authority-category"
                key={category}
                aria-labelledby={`business-authority-category-${category}`}
              >
                <header>
                  <p className="eyebrow">{category}</p>
                  <h3 id={`business-authority-category-${category}`}>
                    {copy.categories[category]}
                  </h3>
                </header>
                <div className="business-authority-category__items">
                  {definitions.map((definition) => {
                    const readiness = productionItems.get(definition.key);
                    return (
                      <section
                        className="business-authority-definition"
                        key={definition.key}
                        aria-labelledby={`business-authority-${definition.key}`}
                      >
                        <header>
                          <h4 id={`business-authority-${definition.key}`}>
                            {locale === "en"
                              ? definition.labelEn
                              : definition.labelBg}
                          </h4>
                          <span
                            className="business-authority-readiness-badge"
                            data-status={
                              readiness?.matrixStatus ?? "NOT_AUTHORIZED"
                            }
                          >
                            {
                              copy.matrixStatuses[
                                readiness?.matrixStatus ?? "NOT_AUTHORIZED"
                              ]
                            }
                          </span>
                        </header>
                        <p>
                          {locale === "en"
                            ? definition.descriptionEn
                            : definition.descriptionBg}
                        </p>

                        <div className="business-authority-environments">
                          {(["STAGING", "PRODUCTION"] as const).map(
                            (environmentScope) => {
                              const records = presentationRecords.filter(
                                (record) =>
                                  record.authorityKey === definition.key &&
                                  record.environmentScope === environmentScope,
                              );
                              const readinessItem =
                                environmentScope === "STAGING"
                                  ? stagingItems.get(definition.key)
                                  : productionItems.get(definition.key);
                              return (
                                <article
                                  className="business-authority-record-group"
                                  key={environmentScope}
                                >
                                  <h5>{copy.environments[environmentScope]}</h5>
                                  <AuthorityVersionHistory
                                    approvalsByRecord={approvalsByRecord}
                                    canControl={canControl}
                                    currentReadinessVersion={
                                      readinessItem?.version ?? null
                                    }
                                    locale={locale}
                                    records={records}
                                  />
                                </article>
                              );
                            },
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
