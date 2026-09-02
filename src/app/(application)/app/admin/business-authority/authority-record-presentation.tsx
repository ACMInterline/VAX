import { businessAuthorityContent } from "@/content/business-authority";
import type {
  ProductionAuthorizationPackage,
  ReadinessItem,
} from "@/modules/business-authority/readiness";
import type {
  AuthorityType,
  BusinessAuthorityRecord,
} from "@/modules/business-authority/types";
import {
  authorityValueKind,
  authorityValueSchema,
  containsSensitiveAuthorityContent,
  safeAuthorityTextSchema,
  type AuthorityValue,
} from "@/modules/business-authority/validation";
import { AuthorityRecordActions } from "./authority-record-actions";

type AuthorityLocale = "bg" | "en";

const dateFormatters = {
  bg: new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }),
} as const;

export type AuthorityRecordPresentation = Readonly<
  Pick<
    BusinessAuthorityRecord,
    | "id"
    | "contentHash"
    | "authorityKey"
    | "category"
    | "version"
    | "recordVersion"
    | "environmentScope"
    | "status"
    | "evidenceClass"
    | "requiredAuthorityTypes"
    | "effectiveFrom"
    | "effectiveUntil"
    | "createdAt"
  > & {
    value: AuthorityValue | null;
    sourceReference: string | null;
    safeEvidenceSummary: string | null;
  }
>;

export function dateLabel(locale: AuthorityLocale, value: Date | null): string {
  return value ? dateFormatters[locale].format(value) : "—";
}

function safeDisplayText(
  value: string | null,
  maximumLength: 500 | 2_000,
): string | null {
  if (value === null || containsSensitiveAuthorityContent(value)) return null;
  const parsed = safeAuthorityTextSchema.max(maximumLength).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function safeDisplayReference(value: string | null): string | null {
  const parsed = safeDisplayText(value, 500);
  if (!parsed || !parsed.includes("://")) return parsed;
  try {
    const url = new URL(parsed);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Deliberately strips private actor/provenance fields before a record enters
 * the rendered Server Component tree or its serialized payload.
 */
export function projectAuthorityRecordForPresentation(
  record: BusinessAuthorityRecord,
): AuthorityRecordPresentation {
  const parsedValue = authorityValueSchema.safeParse(record.value);
  return {
    id: record.id,
    contentHash: record.contentHash,
    authorityKey: record.authorityKey,
    category: record.category,
    version: record.version,
    recordVersion: record.recordVersion,
    environmentScope: record.environmentScope,
    status: record.status,
    evidenceClass: record.evidenceClass,
    requiredAuthorityTypes: record.requiredAuthorityTypes,
    value:
      parsedValue.success &&
      !containsSensitiveAuthorityContent(parsedValue.data)
        ? parsedValue.data
        : null,
    sourceReference: safeDisplayReference(record.sourceReference),
    safeEvidenceSummary: safeDisplayText(record.safeEvidenceSummary, 2_000),
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    createdAt: record.createdAt,
  };
}

function PrimitiveValue({
  locale,
  value,
}: {
  locale: AuthorityLocale;
  value: boolean | number | string | null;
}) {
  if (value === null) return <>—</>;
  if (typeof value === "boolean") {
    return (
      <>
        {value
          ? locale === "en"
            ? "Yes"
            : "Да"
          : locale === "en"
            ? "No"
            : "Не"}
      </>
    );
  }
  return <>{String(value)}</>;
}

function StructuredValue({
  locale,
  value,
}: {
  locale: AuthorityLocale;
  value: Exclude<unknown, undefined>;
}) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <PrimitiveValue
        locale={locale}
        value={value as boolean | number | string | null}
      />
    );
  }
  if (Array.isArray(value)) {
    return (
      <ol className="business-authority-value__list">
        {value.map((entry, index) => (
          <li key={index}>
            <StructuredValue locale={locale} value={entry} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="business-authority-value__fields">
        {Object.entries(value as Readonly<Record<string, unknown>>).map(
          ([field, entry]) => (
            <div key={field}>
              <dt>
                <code>{field}</code>
              </dt>
              <dd>
                <StructuredValue locale={locale} value={entry} />
              </dd>
            </div>
          ),
        )}
      </dl>
    );
  }
  return <>—</>;
}

export function AuthorityValueSummary({
  locale,
  value,
}: {
  locale: AuthorityLocale;
  value: unknown;
}) {
  const copy = businessAuthorityContent[locale];
  const parsed = authorityValueSchema.safeParse(value);
  return (
    <section
      className="business-authority-value"
      aria-label={copy.governedValue}
    >
      <h6>{copy.governedValue}</h6>
      {parsed.success && !containsSensitiveAuthorityContent(parsed.data) ? (
        <StructuredValue
          locale={locale}
          value={Object.fromEntries(
            Object.entries(parsed.data as AuthorityValue).filter(
              ([field]) => field !== "kind",
            ),
          )}
        />
      ) : (
        <p>{copy.invalidValue}</p>
      )}
    </section>
  );
}

export function AuthorityRecordDetails({
  locale,
  record,
  approvals,
}: {
  locale: AuthorityLocale;
  record: AuthorityRecordPresentation;
  approvals: ReadonlySet<AuthorityType>;
}) {
  const copy = businessAuthorityContent[locale];
  const sourceReference = safeDisplayReference(record.sourceReference);
  const evidenceSummary = safeDisplayText(record.safeEvidenceSummary, 2_000);

  return (
    <>
      <dl className="business-authority-record__metadata">
        <div>
          <dt>{copy.status}</dt>
          <dd>{copy.statuses[record.status]}</dd>
        </div>
        <div>
          <dt>{copy.version}</dt>
          <dd>{record.version}</dd>
        </div>
        <div>
          <dt>{copy.environment}</dt>
          <dd>{copy.environments[record.environmentScope]}</dd>
        </div>
        <div>
          <dt>{copy.valueKind}</dt>
          <dd>{authorityValueKind(record.value) ?? "—"}</dd>
        </div>
        <div>
          <dt>{copy.evidenceClass}</dt>
          <dd>{copy.evidence[record.evidenceClass]}</dd>
        </div>
        <div>
          <dt>{copy.effective}</dt>
          <dd>
            <time dateTime={record.effectiveFrom.toISOString()}>
              {dateLabel(locale, record.effectiveFrom)}
            </time>
          </dd>
        </div>
        <div>
          <dt>{copy.until}</dt>
          <dd>
            {record.effectiveUntil ? (
              <time dateTime={record.effectiveUntil.toISOString()}>
                {dateLabel(locale, record.effectiveUntil)}
              </time>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>{copy.requiredApprovals}</dt>
          <dd>
            {record.requiredAuthorityTypes
              .map(
                (authorityType) =>
                  `${copy.authorityTypes[authorityType]}${approvals.has(authorityType) ? " ✓" : ""}`,
              )
              .join(", ")}
          </dd>
        </div>
      </dl>

      <AuthorityValueSummary locale={locale} value={record.value} />

      <dl className="business-authority-evidence">
        <div>
          <dt>{copy.sourceReference}</dt>
          <dd>{sourceReference ?? copy.notRecorded}</dd>
        </div>
        <div>
          <dt>{copy.evidenceSummary}</dt>
          <dd>{evidenceSummary ?? copy.notRecorded}</dd>
        </div>
      </dl>
    </>
  );
}

export function orderAuthorityRecords(
  records: readonly AuthorityRecordPresentation[],
): readonly AuthorityRecordPresentation[] {
  return [...records].sort(
    (left, right) =>
      right.version - left.version ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

export function AuthorityVersionHistory({
  locale,
  records,
  currentReadinessVersion,
  approvalsByRecord,
  canControl,
}: {
  locale: AuthorityLocale;
  records: readonly AuthorityRecordPresentation[];
  currentReadinessVersion: number | null;
  approvalsByRecord: ReadonlyMap<string, ReadonlySet<AuthorityType>>;
  canControl: boolean;
}) {
  const copy = businessAuthorityContent[locale];
  const orderedRecords = orderAuthorityRecords(records);

  if (orderedRecords.length === 0) {
    return <p className="business-authority-empty">{copy.noRecord}</p>;
  }

  return (
    <ol className="business-authority-version-history">
      {orderedRecords.map((record, index) => {
        const approvals =
          approvalsByRecord.get(record.id) ?? new Set<AuthorityType>();
        const outstanding = record.requiredAuthorityTypes.filter(
          (authorityType) => !approvals.has(authorityType),
        );
        const latest = index === 0;
        const selected = record.version === currentReadinessVersion;
        return (
          <li className="business-authority-version" key={record.id}>
            <header>
              <strong>
                {copy.version} {record.version}
              </strong>
              <span className="business-authority-version__roles">
                {selected ? (
                  <span data-version-role="current">
                    {copy.currentReadinessVersion}
                  </span>
                ) : null}
                {latest ? (
                  <span data-version-role="latest">{copy.latestVersion}</span>
                ) : null}
                {!latest && !selected ? (
                  <span data-version-role="history">
                    {copy.historicalVersion}
                  </span>
                ) : null}
              </span>
            </header>
            <AuthorityRecordDetails
              approvals={approvals}
              locale={locale}
              record={record}
            />
            {canControl &&
            latest &&
            (record.status === "PROPOSED" ||
              record.status === "UNDER_REVIEW") ? (
              <AuthorityRecordActions
                authorityVersion={record.version}
                contentHash={record.contentHash}
                locale={locale}
                outstandingAuthorityTypes={outstanding}
                recordId={record.id}
                recordVersion={record.recordVersion}
                status={record.status}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function packageRecordForItem(
  item: ReadinessItem,
  report: ProductionAuthorizationPackage,
  records: readonly AuthorityRecordPresentation[],
): AuthorityRecordPresentation | null {
  const relevant = orderAuthorityRecords(
    records.filter(
      (record) =>
        record.authorityKey === item.authorityKey &&
        record.environmentScope === report.environmentScope,
    ),
  );
  return (
    (item.version === null
      ? null
      : relevant.find((record) => record.version === item.version)) ??
    relevant[0] ??
    null
  );
}

function PackageItems({
  locale,
  label,
  items,
  report,
  records,
  approvalsByRecord,
}: {
  locale: AuthorityLocale;
  label: string;
  items: readonly ReadinessItem[];
  report: ProductionAuthorizationPackage;
  records: readonly AuthorityRecordPresentation[];
  approvalsByRecord: ReadonlyMap<string, ReadonlySet<AuthorityType>>;
}) {
  const copy = businessAuthorityContent[locale];
  return (
    <section className="business-authority-package__items">
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>{copy.noItems}</p>
      ) : (
        <ol>
          {items.map((item) => {
            const record = packageRecordForItem(item, report, records);
            return (
              <li key={item.authorityKey}>
                <header>
                  <h5>{locale === "en" ? item.labelEn : item.labelBg}</h5>
                  <strong data-status={item.matrixStatus}>
                    {copy.matrixStatuses[item.matrixStatus]}
                  </strong>
                </header>
                {record ? (
                  <>
                    {item.version === record.version ? (
                      <p className="business-authority-package__selection">
                        {copy.currentReadinessVersion}
                      </p>
                    ) : (
                      <p className="business-authority-package__selection">
                        {copy.latestPendingVersion}
                      </p>
                    )}
                    <AuthorityRecordDetails
                      approvals={
                        approvalsByRecord.get(record.id) ??
                        new Set<AuthorityType>()
                      }
                      locale={locale}
                      record={record}
                    />
                  </>
                ) : (
                  <p>{copy.noRecord}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function AuthorityPackageSummary({
  locale,
  report,
  records,
  approvalsByRecord,
}: {
  locale: AuthorityLocale;
  report: ProductionAuthorizationPackage;
  records: readonly AuthorityRecordPresentation[];
  approvalsByRecord: ReadonlyMap<string, ReadonlySet<AuthorityType>>;
}) {
  const copy = businessAuthorityContent[locale];
  return (
    <article className="business-authority-package">
      <header>
        <p className="eyebrow">{copy.environments[report.environmentScope]}</p>
        <h3>{report.ready ? copy.ready : copy.blocked}</h3>
      </header>
      <dl className="business-authority-package__counts">
        <div>
          <dt>{copy.approvedCount}</dt>
          <dd>{report.approvedItems.length}</dd>
        </div>
        <div>
          <dt>{copy.pendingCount}</dt>
          <dd>{report.pendingItems.length}</dd>
        </div>
      </dl>
      <h4>{copy.categorySummary}</h4>
      <ul className="business-authority-package__categories">
        {report.categories.map((entry) => (
          <li key={entry.category}>
            <span>{copy.categories[entry.category]}</span>
            <strong data-status={entry.status}>
              {entry.status === "PASS"
                ? copy.matrixStatuses.PASS
                : `${copy.pendingCount}: ${entry.blockerCount}`}
            </strong>
          </li>
        ))}
      </ul>
      <PackageItems
        approvalsByRecord={approvalsByRecord}
        items={report.approvedItems}
        label={copy.approvedItems}
        locale={locale}
        records={records}
        report={report}
      />
      <PackageItems
        approvalsByRecord={approvalsByRecord}
        items={report.pendingItems}
        label={copy.pendingItems}
        locale={locale}
        records={records}
        report={report}
      />
      <h4>{copy.blockers}</h4>
      {report.blockers.length > 0 ? (
        <ul className="business-authority-blockers">
          {report.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p>{copy.noBlockers}</p>
      )}
    </article>
  );
}
