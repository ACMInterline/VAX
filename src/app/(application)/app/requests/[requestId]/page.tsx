import Link from "next/link";
import { ApplicationConfirmationAction } from "@/components/application/confirmation-action";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import {
  CreateCustomerFromRequestForm,
  EstimateCreationForm,
  QuoteDraftForm,
  RequestLinkForm,
  RequestNormalizationForm,
  RequestResolutionForm,
  RequestTransitionForm,
  type NormalizedRequestItemView,
} from "@/components/request-quote/staff-workflow-forms";
import {
  isCurrentQuotableEstimate,
  isLatestEditableQuoteDraft,
} from "@/components/request-quote/quote-version-policy";
import { requestQuoteContent } from "@/content/request-quote";
import { getDatabase } from "@/db/client";
import { createDatabaseCustomerCrmRepository } from "@/modules/customer-crm/repository";
import { createCustomerCrmService } from "@/modules/customer-crm/service";
import type { RequestStatus } from "@/modules/request-quote/types";
import {
  appendEstimateAction,
  createCustomerFromRequestAction,
  createQuoteDraftAction,
  expireQuoteAction,
  issueQuoteAction,
  linkRequestAction,
  normalizeRequestAction,
  setRequestResolutionAction,
  transitionRequestAction,
  updateQuoteDraftAction,
  withdrawQuoteAction,
} from "../actions";
import {
  getRequestNormalizationOptions,
  loadStaffRequestCustomerOptions,
} from "../_lib/options";
import {
  createRequestQuotePageService,
  loadStaffRequestOrNotFound,
  parseStaffRequestRouteParams,
  requireStaffRequestReadPageContext,
  type StaffRequestRouteParams,
} from "../_lib/request-page";

export const dynamic = "force-dynamic";

type UnknownRecord = Readonly<Record<string, unknown>>;

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberList(value: unknown): readonly number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number")
    : [];
}

function normalizedItem(item: UnknownRecord): NormalizedRequestItemView | null {
  const id = nullableString(item.id);
  const version = nullableNumber(item.version);
  const customerDescription = nullableString(item.customerDescription);
  if (!id || !version || !customerDescription) return null;
  return {
    id,
    version,
    serviceId: nullableNumber(item.serviceId),
    cleaningItemTypeId: nullableNumber(item.cleaningItemTypeId),
    cleaningAssetId: nullableString(item.cleaningAssetId),
    measurementModeId: nullableNumber(item.measurementModeId),
    customerReportedConditionLevelId: nullableNumber(
      item.customerReportedConditionLevelId,
    ),
    normalizedConditionLevelId: nullableNumber(item.normalizedConditionLevelId),
    reportedFibreMaterialId: nullableNumber(item.reportedFibreMaterialId),
    reportedSurfaceConstructionId: nullableNumber(
      item.reportedSurfaceConstructionId,
    ),
    normalizedFibreMaterialId: nullableNumber(item.normalizedFibreMaterialId),
    normalizedSurfaceConstructionId: nullableNumber(
      item.normalizedSurfaceConstructionId,
    ),
    customerDescription,
    normalizedDescription: nullableString(item.normalizedDescription),
    quantity: number(item.quantity, 1),
    areaHundredthsM2: nullableNumber(item.areaHundredthsM2),
    seatCount: nullableNumber(item.seatCount),
    sides: nullableNumber(item.sides),
    sortOrder: number(item.sortOrder),
    issueTypeIds: numberList(item.issueTypeIds),
    addonIds: numberList(item.addonIds),
  };
}

function transitionTargets(status: RequestStatus): readonly RequestStatus[] {
  switch (status) {
    case "SUBMITTED":
      return ["IN_REVIEW"];
    case "IN_REVIEW":
      return ["NEEDS_REVIEW", "READY_TO_QUOTE", "DECLINED"];
    case "NEEDS_REVIEW":
      return ["IN_REVIEW", "READY_TO_QUOTE", "DECLINED"];
    case "READY_TO_QUOTE":
      return ["IN_REVIEW", "DECLINED"];
    case "QUOTED":
      return ["CLOSED"];
    case "CLOSED":
    case "DECLINED":
      return [];
  }
}

function date(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export default async function StaffRequestDetailPage({
  params,
}: {
  params: Promise<StaffRequestRouteParams>;
}) {
  const { actor, locale } = await requireStaffRequestReadPageContext();
  const { requestId } = await parseStaffRequestRouteParams(params);
  const requestService = createRequestQuotePageService();
  const request = await loadStaffRequestOrNotFound(
    requestService,
    actor,
    requestId,
  );
  const content = requestQuoteContent[locale];
  const database = getDatabase();
  const canManage =
    actor.permissions.has("CUSTOMER_RECORDS_MANAGE") &&
    actor.permissions.has("OPERATIONS_MANAGE");
  const crmService = createCustomerCrmService(
    createDatabaseCustomerCrmRepository(database),
  );
  const [customers, catalogue] = canManage
    ? await Promise.all([
        loadStaffRequestCustomerOptions(crmService, actor),
        getRequestNormalizationOptions(database, locale),
      ])
    : [[], null] as const;
  const items = request.items
    .map((item) => normalizedItem(item))
    .filter((item): item is NormalizedRequestItemView => item !== null);
  const linkedCustomer = customers.find((customer) => customer.id === request.customerId);
  const linkedAssets = linkedCustomer?.properties
    .filter((property) => !request.propertyId || property.id === request.propertyId)
    .flatMap((property) =>
      property.assets.map((asset) => ({
        id: asset.id,
        label: `${property.label} — ${asset.label}`,
      })),
    ) ?? [];
  const formatter = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const latestEstimate = request.estimates.at(-1);
  const latestEstimateId = latestEstimate
    ? nullableString(latestEstimate.id)
    : null;
  const hasCurrentEstimate =
    latestEstimate !== undefined &&
    latestEstimateId !== null &&
    number(latestEstimate.source_request_version) === request.version;
  const latestEstimateAllowsQuote =
    latestEstimate !== undefined &&
    latestEstimateId !== null &&
    isCurrentQuotableEstimate(
      number(latestEstimate.source_request_version),
      request.version,
      latestEstimate.decline_or_refer_required,
    );
  const latestQuoteVersion = request.quoteHistory.reduce(
    (latest, quote) => Math.max(latest, number(quote.quote_version)),
    0,
  );
  const hasLatestDraft = request.quoteHistory.some((quote) =>
    isLatestEditableQuoteDraft(
      string(quote.status),
      number(quote.quote_version),
      latestQuoteVersion,
    ),
  );
  const renderedAt = new Date();
  const terminal = request.status === "CLOSED" || request.status === "DECLINED";

  return (
    <section className="crm-page" aria-labelledby="request-detail-heading">
      <Link className="crm-back-link" href="/app/requests">{content.common.back}</Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.labels.requestSources[request.source]}</p>
          <h1 id="request-detail-heading">{content.detail.title(request.requestReference)}</h1>
          <p>{formatter.format(request.submittedAt)}</p>
        </div>
        <ApplicationStatusBadge label={content.labels.requestStatuses[request.status]} />
      </header>

      <article className="crm-card">
        <dl className="crm-card__details">
          <div><dt>{content.detail.contact}</dt><dd>{request.contactName}</dd></div>
          <div><dt>{content.forms.contactEmail}</dt><dd>{request.contactEmail ?? content.common.noValue}</dd></div>
          <div><dt>{content.forms.contactPhone}</dt><dd>{request.contactPhone ?? content.common.noValue}</dd></div>
          <div><dt>{content.inbox.resolution}</dt><dd>{content.labels.resolutionStatuses[request.customerResolutionStatus]}</dd></div>
          <div><dt>{content.detail.preferredTiming}</dt><dd>{request.preferredDate ?? content.common.noValue}{request.preferredWindowCode ? ` · ${request.preferredWindowCode}` : ""}</dd></div>
          <div><dt>{content.detail.requestVersion}</dt><dd>{request.version}</dd></div>
          <div><dt>{content.detail.manualReviewRequired}</dt><dd>{request.manualReviewRequired ? (locale === "bg" ? "Да" : "Yes") : (locale === "bg" ? "Не" : "No")}</dd></div>
          <div><dt>{content.detail.staffNotes}</dt><dd>{request.staffNotes ?? content.common.noValue}</dd></div>
        </dl>
      </article>

      <section className="crm-management-card" aria-labelledby="original-submission-heading">
        <h2 id="original-submission-heading">{content.detail.original}</h2>
        <p>{request.customerNotes ?? content.common.noValue}</p>
        <details>
          <summary>{locale === "bg" ? "Запазен оригинален запис" : "Preserved original record"}</summary>
          <pre>{JSON.stringify(request.originalSubmission, null, 2)}</pre>
        </details>
      </section>

      <section className="crm-management-card" aria-labelledby="normalized-items-heading">
        <h2 id="normalized-items-heading">{content.detail.normalized}</h2>
        {items.length === 0 ? <p>{content.detail.noItems}</p> : (
          <ol>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.normalizedDescription ?? item.customerDescription}</strong>
                <span> · {locale === "bg" ? "Количество" : "Quantity"}: {item.quantity}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {canManage && request.customerResolutionStatus !== "LINKED" ? (
        <>
          <RequestResolutionForm
            action={setRequestResolutionAction}
            expectedVersion={request.version}
            fromStatus={request.customerResolutionStatus}
            locale={locale}
            requestId={request.id}
          />
          <RequestLinkForm
            action={linkRequestAction}
            customers={customers}
            expectedVersion={request.version}
            locale={locale}
            requestId={request.id}
          />
          <CreateCustomerFromRequestForm
            action={createCustomerFromRequestAction}
            contactName={request.contactName}
            expectedVersion={request.version}
            locale={locale}
            requestId={request.id}
            serviceZones={catalogue?.serviceZones ?? []}
          />
        </>
      ) : null}

      {canManage && request.customerResolutionStatus === "LINKED" && linkedCustomer && !terminal ? (
        <RequestLinkForm
          action={linkRequestAction}
          customers={[linkedCustomer]}
          expectedVersion={request.version}
          lockedCustomerId={linkedCustomer.id}
          locale={locale}
          requestId={request.id}
          selectedPropertyId={request.propertyId}
        />
      ) : null}

      {canManage &&
      catalogue &&
      (request.status === "IN_REVIEW" || request.status === "NEEDS_REVIEW") &&
      items.length > 0 ? (
        <RequestNormalizationForm
          action={normalizeRequestAction}
          expectedVersion={request.version}
          items={items}
          locale={locale}
          options={{ ...catalogue, assets: linkedAssets }}
          requestId={request.id}
          staffNotes={request.staffNotes}
        />
      ) : null}

      {canManage ? (
        <RequestTransitionForm
          action={transitionRequestAction}
          expectedVersion={request.version}
          fromStatus={request.status}
          locale={locale}
          requestId={request.id}
          targets={transitionTargets(request.status)}
        />
      ) : null}

      <section className="crm-management-card" aria-labelledby="request-estimates-heading">
        <h2 id="request-estimates-heading">{content.detail.estimates}</h2>
        {request.estimates.length === 0 ? <p>{content.detail.noEstimates}</p> : (
          <ol>
            {request.estimates.map((estimate, index) => {
              const total = nullableNumber(estimate.gross_total_minor_units);
              const calculated = date(estimate.calculated_at);
              return (
                <li key={string(estimate.id, String(index))}>
                  <strong>
                    {locale === "bg" ? "Версия" : "Version"} {number(estimate.estimate_version, index + 1)}
                  </strong>
                  <span> · {string(estimate.status, "REVIEW_REQUIRED")}</span>
                  <span> · {total === null ? content.common.noValue : money.format(total / 100)}</span>
                  {calculated ? <time dateTime={calculated.toISOString()}> · {formatter.format(calculated)}</time> : null}
                  {array(estimate.review_reason_codes).length > 0 ? (
                    <ul>{array(estimate.review_reason_codes).map((reason) => <li key={String(reason)}>{String(reason)}</li>)}</ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        <p className="crm-form__notice"><strong>{content.detail.advisoryAvailability}.</strong> {content.detail.advisoryOnly}</p>
        {hasCurrentEstimate && !latestEstimateAllowsQuote ? (
          <p className="crm-form__notice">
            {locale === "bg"
              ? "Текущата оценка изисква отказ или насочване и не може да бъде използвана за оферта."
              : "The current estimate requires decline or referral and cannot be used for a quote."}
          </p>
        ) : null}
      </section>

      {canManage &&
      (request.status === "IN_REVIEW" ||
        request.status === "NEEDS_REVIEW" ||
        request.status === "READY_TO_QUOTE" ||
        request.status === "QUOTED") &&
      items.length > 0 ? (
        <EstimateCreationForm
          action={appendEstimateAction}
          expectedVersion={request.version}
          locale={locale}
          requestId={request.id}
        />
      ) : null}

      <section className="crm-management-card" aria-labelledby="request-quotes-heading">
        <h2 id="request-quotes-heading">{content.detail.quotes}</h2>
        {request.quoteHistory.length === 0 ? <p>{content.detail.noQuotes}</p> : (
          <ol>
            {request.quoteHistory.map((quote, index) => {
              const quoteId = string(quote.id);
              const status = string(quote.status);
              const recordVersion = number(quote.record_version, 1);
              const total = number(quote.gross_total_minor_units);
              const quoteLines = array(quote.items)
                .map(record)
                .filter((line): line is UnknownRecord => line !== null);
              const historicalLines = quoteLines.flatMap((line) => {
                const requestItemId = nullableString(line.requestItemId);
                if (!requestItemId) return [];
                const calculationSnapshot = record(line.calculationSnapshot);
                const manualOverride = record(
                  calculationSnapshot?.manualOverride,
                );
                return [{
                  id: requestItemId,
                  description:
                    nullableString(line.descriptionEn) ??
                    nullableString(line.descriptionBg) ??
                    content.common.noValue,
                  descriptionBg: nullableString(line.descriptionBg) ?? "",
                  descriptionEn: nullableString(line.descriptionEn) ?? "",
                  quantity: number(line.quantity, 1),
                  netAmountMinorUnits: number(line.netAmountMinorUnits),
                  manualOverrideReason:
                    nullableString(manualOverride?.reason) ?? "",
                }];
              });
              const historicalLineByItemId = new Map(
                historicalLines.map((line) => [line.id, line] as const),
              );
              const editableLines = items.map((item) => {
                const historical = historicalLineByItemId.get(item.id);
                const description =
                  item.normalizedDescription ?? item.customerDescription;
                return {
                  id: item.id,
                  description,
                  descriptionBg: historical?.descriptionBg ?? description,
                  descriptionEn: historical?.descriptionEn ?? description,
                  quantity: item.quantity,
                  netAmountMinorUnits: historical?.netAmountMinorUnits ?? 0,
                  manualOverrideReason:
                    historical?.manualOverrideReason ?? "",
                };
              });
              const terms = record(quote.terms_snapshot);
              const validUntil = date(quote.valid_until);
              const quoteVersion = number(quote.quote_version, index + 1);
              const isLatestDraft = isLatestEditableQuoteDraft(
                status,
                quoteVersion,
                latestQuoteVersion,
              );
              const isCurrentRequestQuote =
                number(quote.source_request_version) === request.version;
              const canUpdateLatestDraft =
                canManage &&
                isLatestDraft &&
                latestEstimateAllowsQuote &&
                latestEstimateId &&
                (request.status === "READY_TO_QUOTE" ||
                  request.status === "QUOTED");
              return (
                <li key={quoteId || String(index)}>
                  <strong>{string(quote.quote_reference, `#${index + 1}`)}</strong>
                  <span> · {status} · {money.format(total / 100)}</span>
                  {canManage && isLatestDraft && !isCurrentRequestQuote ? (
                    <p className="crm-form__notice">
                      {locale === "bg"
                        ? "Тази чернова е от по-стара версия на заявката. Създайте актуална оценка и запазете черновата отново преди издаване."
                        : "This draft belongs to an older request version. Create a current estimate and save the draft again before issuing it."}
                    </p>
                  ) : null}
                  {canUpdateLatestDraft && quoteId && validUntil ? (
                    <QuoteDraftForm
                      action={updateQuoteDraftAction}
                      expectedRecordVersion={recordVersion}
                      expectedRequestVersion={request.version}
                      initial={{
                        validUntil: validUntil.toISOString().slice(0, 10),
                        vatRateBasisPoints: number(quote.vat_rate_basis_points, 2_000),
                        estimatedDurationMinutes: nullableNumber(quote.estimated_duration_minutes),
                        customerNotes: nullableString(quote.customer_notes),
                        additionalAssumptions: nullableString(terms?.additionalAssumptions),
                        staffNotes: nullableString(quote.staff_notes),
                      }}
                      items={editableLines}
                      locale={locale}
                      mode="update"
                      quoteId={quoteId}
                      requestId={request.id}
                    />
                  ) : null}
                  {canManage && isLatestDraft && isCurrentRequestQuote && quoteId ? (
                    <ApplicationConfirmationAction
                      action={issueQuoteAction}
                      cancelLabel={locale === "bg" ? "Отказ" : "Cancel"}
                      confirmLabel={content.forms.issueQuote}
                      description={locale === "bg" ? "Издаването замразява търговската версия и я прави видима за свързания клиент." : "Issuing freezes this commercial version and makes it visible to the linked customer."}
                      fields={{ quoteId, expectedRecordVersion: String(recordVersion) }}
                      initialState={{ status: "IDLE" }}
                      title={content.forms.issueQuote}
                    >
                      {content.forms.issueQuote}
                    </ApplicationConfirmationAction>
                  ) : null}
                  {canManage && status === "ISSUED" && quoteId ? (
                    <>
                      <ApplicationConfirmationAction
                        action={withdrawQuoteAction}
                        cancelLabel={locale === "bg" ? "Отказ" : "Cancel"}
                        confirmLabel={content.forms.withdrawQuote}
                        description={locale === "bg" ? "Оттеглената версия остава в историята на клиента." : "The withdrawn version remains in the customer's history."}
                        fields={{ quoteId, expectedRecordVersion: String(recordVersion) }}
                        initialState={{ status: "IDLE" }}
                        title={content.forms.withdrawQuote}
                        variant="danger"
                      >
                        {content.forms.withdrawQuote}
                      </ApplicationConfirmationAction>
                      {validUntil && validUntil <= renderedAt ? (
                        <ApplicationConfirmationAction
                          action={expireQuoteAction}
                          cancelLabel={locale === "bg" ? "Отказ" : "Cancel"}
                          confirmLabel={locale === "bg" ? "Маркирай изтекла" : "Mark expired"}
                          description={locale === "bg" ? "Валидността е изтекла. Версията остава в историята на клиента." : "The validity window has ended. This version remains in customer history."}
                          fields={{ quoteId, expectedRecordVersion: String(recordVersion) }}
                          initialState={{ status: "IDLE" }}
                          title={locale === "bg" ? "Изтекла оферта" : "Expire quote"}
                        >
                          {locale === "bg" ? "Маркирай изтекла" : "Mark expired"}
                        </ApplicationConfirmationAction>
                      ) : null}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {canManage &&
      latestEstimateId &&
      latestEstimateAllowsQuote &&
      !hasLatestDraft &&
      request.customerId &&
      (request.status === "READY_TO_QUOTE" || request.status === "QUOTED") ? (
        <QuoteDraftForm
          action={createQuoteDraftAction}
          expectedRequestVersion={request.version}
          items={items.map((item) => ({
            id: item.id,
            description: item.normalizedDescription ?? item.customerDescription,
            quantity: item.quantity,
          }))}
          locale={locale}
          requestId={request.id}
        />
      ) : null}

      <section className="crm-management-card" aria-labelledby="request-timeline-heading">
        <h2 id="request-timeline-heading">{content.detail.timeline}</h2>
        {request.auditTimeline.length === 0 ? <p>{content.common.noValue}</p> : (
          <ol>
            {request.auditTimeline.map((event, index) => {
              const created = date(event.createdAt);
              return (
                <li key={string(event.id, String(index))}>
                  <strong>{string(event.eventType, "EVENT")}</strong>
                  {created ? <time dateTime={created.toISOString()}> · {formatter.format(created)}</time> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}
