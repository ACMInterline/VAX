import Link from "next/link";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { jobExecutionContent } from "./content";
import type {
  JobStatus,
  TechnicianJobDetail,
  TechnicianJobItem,
  TechnicianJobListItem,
} from "./types";

function formatDateTime(value: Date, locale: AuthLocale): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(value);
}

function formatDuration(
  minutes: number | null,
  locale: AuthLocale,
): string {
  if (minutes == null) return "—";
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes);
}

function StatusBadge({
  locale,
  status,
}: {
  locale: AuthLocale;
  status: JobStatus;
}) {
  const presentation = jobExecutionContent[locale].statuses[status];
  return (
    <ApplicationStatusBadge
      label={presentation.label}
      tone={presentation.tone}
    />
  );
}

function Values({
  empty,
  values,
}: {
  empty: string;
  values: readonly string[];
}) {
  return values.length > 0 ? <span>{values.join(", ")}</span> : <span>{empty}</span>;
}

export function TechnicianJobList({
  jobs,
  locale,
}: {
  jobs: readonly TechnicianJobListItem[];
  locale: AuthLocale;
}) {
  const content = jobExecutionContent[locale].list;

  if (jobs.length === 0) {
    return (
      <section className="crm-empty-state" aria-labelledby="job-list-empty-title">
        <h2 id="job-list-empty-title">{content.emptyTitle}</h2>
        <p>{content.emptyText}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="job-list-title">
      <h2 id="job-list-title">{content.title}</h2>
      <ul className="crm-customer-list job-execution-list">
        {jobs.map((job) => (
          <li key={job.reference}>
            <article className="crm-summary-card job-execution-card">
              <header className="crm-summary-card__header">
                <div>
                  <p className="crm-card__eyebrow">{job.reference}</p>
                  <h3>{job.propertyLabel}</h3>
                </div>
                <StatusBadge locale={locale} status={job.status} />
              </header>
              <dl className="crm-card__details">
                <div>
                  <dt>{content.scheduled}</dt>
                  <dd>
                    {job.scheduledStart
                      ? formatDateTime(job.scheduledStart, locale)
                      : content.unscheduled}
                  </dd>
                </div>
                <div>
                  <dt>{content.duration}</dt>
                  <dd>{formatDuration(job.plannedDurationMinutes, locale)}</dd>
                </div>
                <div>
                  <dt>{content.customer}</dt>
                  <dd>{job.customerDisplayName}</dd>
                </div>
                <div>
                  <dt>{content.team}</dt>
                  <dd>{job.assignedTeamLabel ?? content.unassigned}</dd>
                </div>
                <div>
                  <dt>{content.address}</dt>
                  <dd>{job.serviceAddress}</dd>
                </div>
                <div>
                  <dt>{content.access}</dt>
                  <dd>{job.accessInstructions ?? content.noAccess}</dd>
                </div>
                <div>
                  <dt>{content.items}</dt>
                  <dd><Values empty="—" values={job.itemLabels} /></dd>
                </div>
              </dl>
              {job.reviewReasons.length > 0 ? (
                <aside className="crm-card__warning" aria-label={content.review}>
                  <strong>{content.review}</strong>
                  <ul>
                    {job.reviewReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </aside>
              ) : null}
              <p>
                <Link className="crm-button" href={`/app/jobs/${job.reference}`}>
                  {content.open}
                </Link>
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlannedSection({
  item,
  locale,
  titleId,
}: {
  item: TechnicianJobItem;
  locale: AuthLocale;
  titleId: string;
}) {
  const content = jobExecutionContent[locale].detail;
  const planned = item.planned;
  return (
    <section className="crm-card__section" aria-labelledby={titleId}>
      <h4 id={titleId}>{content.planned}</h4>
      <dl className="crm-card__details">
        <div><dt>{content.service}</dt><dd>{planned.serviceLabel}</dd></div>
        <div><dt>{content.item}</dt><dd>{planned.itemLabel}</dd></div>
        <div><dt>{content.quantity}</dt><dd>{planned.quantityLabel}</dd></div>
        <div><dt>{content.measurement}</dt><dd>{planned.measurementLabel ?? content.none}</dd></div>
        <div><dt>{content.condition}</dt><dd>{planned.reportedConditionLabel ?? content.none}</dd></div>
        <div><dt>{content.material}</dt><dd>{planned.reportedMaterialLabel ?? content.none}</dd></div>
        <div><dt>{content.construction}</dt><dd>{planned.reportedConstructionLabel ?? content.none}</dd></div>
        <div><dt>{content.issues}</dt><dd><Values empty={content.none} values={planned.reportedIssueLabels} /></dd></div>
        <div><dt>{content.addons}</dt><dd><Values empty={content.none} values={planned.requestedAddonLabels} /></dd></div>
        {planned.customerDescription ? (
          <div><dt>{content.customerDescription}</dt><dd>{planned.customerDescription}</dd></div>
        ) : null}
      </dl>
    </section>
  );
}

function ObservedSection({
  item,
  locale,
  titleId,
}: {
  item: TechnicianJobItem;
  locale: AuthLocale;
  titleId: string;
}) {
  const content = jobExecutionContent[locale].detail;
  const observed = item.observed;
  return (
    <section className="crm-card__section" aria-labelledby={titleId}>
      <h4 id={titleId}>{content.observed}</h4>
      {observed ? (
        <dl className="crm-card__details">
          <div><dt>{content.inspectedAt}</dt><dd>{formatDateTime(observed.inspectedAt, locale)}</dd></div>
          <div><dt>{content.condition}</dt><dd>{observed.conditionLabel}</dd></div>
          <div><dt>{content.material}</dt><dd>{observed.materialLabel ?? content.none}</dd></div>
          <div><dt>{content.construction}</dt><dd>{observed.constructionLabel ?? content.none}</dd></div>
          <div><dt>{content.measurement}</dt><dd>{observed.measurementLabel ?? content.none}</dd></div>
          <div><dt>{content.issues}</dt><dd><Values empty={content.none} values={observed.issueLabels} /></dd></div>
          <div><dt>{content.risks}</dt><dd><Values empty={content.none} values={observed.riskLabels} /></dd></div>
        </dl>
      ) : <p>{content.notRecorded}</p>}
    </section>
  );
}

function ConfirmedTreatmentSection({
  item,
  locale,
  titleId,
}: {
  item: TechnicianJobItem;
  locale: AuthLocale;
  titleId: string;
}) {
  const content = jobExecutionContent[locale];
  const treatment = item.confirmedTreatment;
  return (
    <section className="crm-card__section" aria-labelledby={titleId}>
      <h4 id={titleId}>{content.detail.confirmedTreatment}</h4>
      {treatment ? (
        <dl className="crm-card__details">
          <div><dt>{content.detail.confirmedAt}</dt><dd>{formatDateTime(treatment.confirmedAt, locale)}</dd></div>
          <div><dt>{content.detail.outcome}</dt><dd>{content.planDecisions[treatment.decision]}</dd></div>
          <div><dt>{content.detail.method}</dt><dd>{treatment.methodLabel ?? content.detail.none}</dd></div>
          <div><dt>{content.detail.addons}</dt><dd><Values empty={content.detail.none} values={treatment.addonLabels} /></dd></div>
          <div><dt>{content.detail.product}</dt><dd>{treatment.productLabel ?? content.detail.none}</dd></div>
        </dl>
      ) : <p>{content.detail.notRecorded}</p>}
    </section>
  );
}

function PerformedSection({
  item,
  locale,
  titleId,
}: {
  item: TechnicianJobItem;
  locale: AuthLocale;
  titleId: string;
}) {
  const content = jobExecutionContent[locale];
  const performed = item.performed;
  return (
    <section className="crm-card__section" aria-labelledby={titleId}>
      <h4 id={titleId}>{content.detail.performed}</h4>
      {performed ? (
        <dl className="crm-card__details">
          <div><dt>{content.detail.outcome}</dt><dd>{content.resultClassifications[performed.resultClassification]}</dd></div>
          <div><dt>{content.detail.startedAt}</dt><dd>{performed.startedAt ? formatDateTime(performed.startedAt, locale) : content.detail.none}</dd></div>
          <div><dt>{content.detail.completedAt}</dt><dd>{performed.completedAt ? formatDateTime(performed.completedAt, locale) : content.detail.none}</dd></div>
          <div><dt>{content.detail.method}</dt><dd>{performed.methodLabel ?? content.detail.none}</dd></div>
          <div><dt>{content.detail.addons}</dt><dd><Values empty={content.detail.none} values={performed.addonLabels} /></dd></div>
          <div><dt>{content.detail.product}</dt><dd>{performed.productLabel ?? content.detail.none}</dd></div>
          <div><dt>{content.detail.completionSummary}</dt><dd>{performed.customerVisibleSummary ?? content.detail.none}</dd></div>
          <div><dt>{content.detail.careInstructions}</dt><dd>{performed.careInstructions ?? content.detail.none}</dd></div>
        </dl>
      ) : <p>{content.detail.notRecorded}</p>}
    </section>
  );
}

function TechnicianJobItemCard({
  item,
  locale,
}: {
  item: TechnicianJobItem;
  locale: AuthLocale;
}) {
  const content = jobExecutionContent[locale];
  const status = content.itemStatuses[item.status];
  const baseId = `job-item-${item.id}`;
  return (
    <article className="crm-card job-execution-item-card" aria-labelledby={`${baseId}-title`}>
      <header className="crm-card__header">
        <h3 id={`${baseId}-title`}>{item.planned.itemLabel}</h3>
        <ApplicationStatusBadge label={status.label} tone={status.tone} />
      </header>
      <PlannedSection item={item} locale={locale} titleId={`${baseId}-planned`} />
      <ObservedSection item={item} locale={locale} titleId={`${baseId}-observed`} />
      <ConfirmedTreatmentSection item={item} locale={locale} titleId={`${baseId}-confirmed`} />
      <PerformedSection item={item} locale={locale} titleId={`${baseId}-performed`} />
    </article>
  );
}

export function TechnicianJobDetailCard({
  job,
  locale,
}: {
  job: TechnicianJobDetail;
  locale: AuthLocale;
}) {
  const content = jobExecutionContent[locale].detail;
  return (
    <article className="crm-card job-execution-detail">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">{content.title}</p>
          <h2>{job.reference}</h2>
        </div>
        <StatusBadge locale={locale} status={job.status} />
      </header>
      <dl className="crm-card__details">
        <div><dt>{content.scheduled}</dt><dd>{job.scheduledStart ? formatDateTime(job.scheduledStart, locale) : content.unscheduled}</dd></div>
        <div><dt>{content.duration}</dt><dd>{formatDuration(job.plannedDurationMinutes, locale)}</dd></div>
        <div><dt>{content.customer}</dt><dd>{job.customerDisplayName}</dd></div>
        <div><dt>{content.team}</dt><dd>{job.assignedTeamLabel ?? content.unassigned}</dd></div>
        <div><dt>{content.address}</dt><dd>{job.serviceAddress}</dd></div>
        <div><dt>{content.contact}</dt><dd>{job.visitContact?.name ?? content.contactUnavailable}{job.visitContact?.phone ? ` · ${job.visitContact.phone}` : job.visitContact ? ` · ${content.phoneUnavailable}` : ""}</dd></div>
        <div><dt>{content.access}</dt><dd>{job.accessInstructions ?? content.noAccess}</dd></div>
        <div><dt>{content.parking}</dt><dd>{job.parkingInstructions ?? content.noParking}</dd></div>
        {job.customerServiceNotes ? (
          <div><dt>{content.customerServiceNotes}</dt><dd>{job.customerServiceNotes}</dd></div>
        ) : null}
      </dl>
      {job.reviewReasons.length > 0 ? (
        <section className="crm-card__section crm-card__section--internal" aria-labelledby="job-review-reasons">
          <h3 id="job-review-reasons">{content.review}</h3>
          <ul>{job.reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      ) : null}
      <section className="crm-card__section" aria-labelledby="job-items-title">
        <h2 id="job-items-title">{content.items}</h2>
        {job.items.length === 0 ? <p>{content.noItems}</p> : (
          <div className="crm-card-grid job-execution-item-grid">
            {job.items.map((item) => <TechnicianJobItemCard key={item.id} item={item} locale={locale} />)}
          </div>
        )}
      </section>
    </article>
  );
}
