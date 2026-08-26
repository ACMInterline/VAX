import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { jobExecutionContent } from "./content";
import type {
  CustomerCleaningPassport,
  StaffAssetHistory,
} from "./types";

function formatDate(value: Date, locale: AuthLocale): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
  }).format(value);
}

function Values({
  empty,
  values,
}: {
  empty: string;
  values: readonly string[];
}) {
  return values.length > 0 ? values.join(", ") : empty;
}

export function StaffAssetHistoryCard({
  history,
  locale,
}: {
  history: StaffAssetHistory;
  locale: AuthLocale;
}) {
  const content = jobExecutionContent[locale];
  return (
    <article className="crm-card job-asset-history">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">{content.history.staffTitle}</p>
          <h2>{history.assetLabel}</h2>
        </div>
      </header>
      <p className="crm-card__address">
        <strong>{content.history.property}:</strong> {history.propertyLabel}
      </p>
      {history.entries.length === 0 ? (
        <section className="crm-card__empty-state" aria-labelledby="staff-history-empty-title">
          <h3 id="staff-history-empty-title">{content.history.noEntriesTitle}</h3>
          <p>{content.history.noEntriesText}</p>
        </section>
      ) : (
        <div className="crm-card-grid job-asset-history__entries">
          {history.entries.map((entry) => (
            <article key={entry.id} className="crm-card" aria-labelledby={`history-${entry.id}`}>
              <header className="crm-card__header">
                <div>
                  <p className="crm-card__eyebrow">{entry.jobReference}</p>
                  <h3 id={`history-${entry.id}`}>{formatDate(entry.completedAt, locale)}</h3>
                </div>
                <ApplicationStatusBadge
                  label={content.resultClassifications[entry.resultClassification]}
                  tone={entry.resultClassification === "STOPPED_FOR_SAFETY" ? "warning" : "positive"}
                />
              </header>
              <dl className="crm-card__details">
                <div><dt>{content.history.service}</dt><dd>{entry.serviceDescription}</dd></div>
                <div><dt>{content.history.condition}</dt><dd>{entry.observedConditionSummary}</dd></div>
                <div><dt>{content.history.treatment}</dt><dd>{entry.treatmentSummary}</dd></div>
                <div><dt>{content.history.issues}</dt><dd><Values empty={content.history.none} values={entry.inspectionIssueSummary} /></dd></div>
                <div><dt>{content.history.risks}</dt><dd><Values empty={content.history.none} values={entry.inspectionRiskSummary} /></dd></div>
                <div><dt>{content.history.care}</dt><dd>{entry.careRecommendation ?? content.history.none}</dd></div>
                {entry.maintenanceRecommendation?.recommendedReviewDate ? <div><dt>{content.history.recommendedReviewDate}</dt><dd>{entry.maintenanceRecommendation.recommendedReviewDate}</dd></div> : null}
                {entry.maintenanceRecommendation?.suggestedIntervalMonths ? <div><dt>{content.history.suggestedIntervalMonths}</dt><dd>{entry.maintenanceRecommendation.suggestedIntervalMonths} {content.history.months}</dd></div> : null}
                {entry.maintenanceRecommendation ? <div><dt>{content.history.recommendationReason}</dt><dd>{entry.maintenanceRecommendation.reason}</dd></div> : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

export function CustomerCleaningPassportCard({
  passport,
  locale,
}: {
  passport: CustomerCleaningPassport;
  locale: AuthLocale;
}) {
  const executionContent = jobExecutionContent[locale];
  const content = executionContent.history;
  return (
    <article className="crm-card customer-cleaning-passport">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">{content.customerTitle}</p>
          <h2>{passport.assetLabel}</h2>
        </div>
      </header>
      <p className="crm-card__notice">{content.customerIntro}</p>
      <p className="crm-card__address">
        <strong>{content.property}:</strong> {passport.propertyLabel}
      </p>
      {passport.entries.length === 0 ? (
        <section className="crm-card__empty-state" aria-labelledby="passport-empty-title">
          <h3 id="passport-empty-title">{content.noEntriesTitle}</h3>
          <p>{content.noEntriesText}</p>
        </section>
      ) : (
        <ol className="crm-card-grid customer-cleaning-passport__entries">
          {passport.entries.map((entry) => {
            const entryKey = `${entry.jobReference}-${entry.completedAt.getTime()}`;
            return (
            <li key={entryKey}>
              <article className="crm-card" aria-labelledby={`passport-${entryKey}`}>
                <header className="crm-card__header">
                  <div>
                    <p className="crm-card__eyebrow">{entry.jobReference}</p>
                    <h3 id={`passport-${entryKey}`}>{formatDate(entry.completedAt, locale)}</h3>
                  </div>
                  <ApplicationStatusBadge
                    label={executionContent.resultClassifications[entry.resultClassification]}
                    tone={entry.resultClassification === "STOPPED_FOR_SAFETY" ? "warning" : "positive"}
                  />
                </header>
                <dl className="crm-card__details">
                  <div><dt>{content.service}</dt><dd>{entry.serviceDescription}</dd></div>
                  <div><dt>{content.condition}</dt><dd>{entry.observedConditionSummary}</dd></div>
                  <div><dt>{content.performed}</dt><dd>{entry.treatmentSummary}</dd></div>
                  {entry.careRecommendation ? (
                    <div><dt>{content.care}</dt><dd>{entry.careRecommendation}</dd></div>
                  ) : null}
                  {entry.maintenanceRecommendation?.recommendedReviewDate ? (
                    <div><dt>{content.recommendedReviewDate}</dt><dd>{entry.maintenanceRecommendation.recommendedReviewDate}</dd></div>
                  ) : null}
                  {entry.maintenanceRecommendation?.suggestedIntervalMonths ? (
                    <div><dt>{content.suggestedIntervalMonths}</dt><dd>{entry.maintenanceRecommendation.suggestedIntervalMonths} {content.months}</dd></div>
                  ) : null}
                  {entry.maintenanceRecommendation ? (
                    <div><dt>{content.recommendationReason}</dt><dd>{entry.maintenanceRecommendation.reason}</dd></div>
                  ) : null}
                </dl>
              </article>
            </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
