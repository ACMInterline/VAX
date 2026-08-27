import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  communicationAuditEvents,
  communicationIntents,
  communicationTemplates,
  customerCommunicationHistoryEntries,
  customerCommunicationPreferences,
  deliveryAttempts,
  deliveryResults,
  documents,
} from "@/db/schema/communications-documents";
import {
  bookingAuditEvents,
  bookingOccupancies,
  bookings,
} from "@/db/schema/booking-engine";
import {
  customerContacts,
  customerIdentityLinks,
  customers,
} from "@/db/schema/customer-crm";
import {
  financeAuditEvents,
  invoices,
  payments,
} from "@/db/schema/finance-invoicing";
import {
  cleaningPassportEntries,
  jobAuditEvents,
  jobs,
} from "@/db/schema/job-execution";
import { businessAuditEvents, quotes } from "@/db/schema/request-quote";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import { sourcePermissions } from "./policy";
import { resolveCommunicationSource } from "./source-repository";
import type {
  CommunicationChannel,
  CommunicationDocumentType,
  CommunicationEventType,
  CommunicationIntentStatus,
  CommunicationMutationResult,
  CommunicationPreferences,
  CommunicationTemplateRecord,
  CustomerDocumentDetail,
  CustomerHistorySummary,
  PersistCommunicationInput,
  PreferencesMutationResult,
  ResolvedCommunicationSource,
  ResolvedDeliveryContext,
  SelectedContactSnapshot,
  StaffCommunicationDetail,
  StaffCommunicationPage,
  StaffCommunicationSummary,
  UpdateCommunicationPreferencesInput,
} from "./types";
import { documentContentSnapshotSchema } from "./validation";

type ContextRow = {
  portalEnabled: boolean;
  emailFutureEnabled: boolean;
  smsFutureEnabled: boolean;
  operationalAllowed: boolean;
  billingAllowed: boolean;
  marketingConsent: boolean;
  preferredLocale: "bg" | "en";
  preferenceVersion: number;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLocale: "bg" | "en" | null;
  contactVersion: number | null;
  templateKey: string;
  templateVersion: number;
  templateLocale: "bg" | "en";
  documentType: CommunicationDocumentType;
  titleTemplate: string;
  bodyTemplate: string;
  variablesContract: unknown;
  templateStatus: "ACTIVE";
};

type MutationRow = {
  result: string;
  communicationReference: string | null;
  documentReference: string | null;
  intentStatus: "DELIVERED_LOCAL" | "QUEUED_FUTURE" | null;
  idempotencyFingerprint: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function staffPermissionSql(
  actorProfileId: string,
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
  manage: boolean,
): SQL {
  const permissions = [
    "COMMUNICATIONS_READ" as const,
    ...(manage ? (["COMMUNICATIONS_MANAGE"] as const) : []),
    ...sourcePermissions(eventType),
  ];
  return sql.join(
    permissions.map((permission) =>
      activeActorPermissionSql(actorProfileId, permission),
    ),
    sql` and `,
  );
}

function staffRowReadSql(actorProfileId: string): SQL {
  return sql`${activeActorPermissionSql(actorProfileId, "COMMUNICATIONS_READ")}
    and (
      (${communicationIntents.sourceType} = 'QUOTE'
        and ${activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "OPERATIONS_READ")})
      or (${communicationIntents.sourceType} = 'BOOKING'
        and ${activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "OPERATIONS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "SCHEDULE_READ")})
      or (${communicationIntents.sourceType} = 'JOB'
        and ${activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "OPERATIONS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ")})
      or (${communicationIntents.sourceType} in ('INVOICE', 'PAYMENT')
        and ${activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ")}
        and ${activeActorPermissionSql(actorProfileId, "FINANCE_READ")})
    )`;
}

function customerAccessSql(actorProfileId: string, customerId: SQL): SQL {
  return sql`${activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ")}
    and exists (
      select 1
      from ${customerIdentityLinks} exact_link
      join ${customers} linked_customer
        on linked_customer.id = exact_link.customer_id
       and linked_customer.status = 'ACTIVE'
      where exact_link.user_profile_id = ${actorProfileId}::uuid
        and exact_link.customer_id = ${customerId}
        and exact_link.active = true
        and exact_link.revoked_at is null
    )`;
}

function sourceAuditColumn(input: PersistCommunicationInput): SQL {
  const source = input.source;
  switch (source.sourceType) {
    case "QUOTE":
      return sql`intent.business_audit_event_id = ${source.businessAuditEventId}::uuid`;
    case "BOOKING":
      return sql`intent.booking_audit_event_id = ${source.bookingAuditEventId}::uuid`;
    case "JOB":
      return sql`intent.job_audit_event_id = ${source.jobAuditEventId}::uuid`;
    case "INVOICE":
    case "PAYMENT":
      return sql`intent.finance_audit_event_id = ${source.financeAuditEventId}::uuid`;
  }
}

function sourceRecheckSql(input: PersistCommunicationInput): SQL {
  const source = input.source;
  const actor = input.actorProfileId;
  const permission = staffPermissionSql(actor, source.eventType, true);
  switch (source.sourceType) {
    case "QUOTE":
      return sql`exists (
        select 1 from ${quotes} quote
        join ${businessAuditEvents} event
          on event.id = ${source.businessAuditEventId}::uuid
         and event.entity_type = 'QUOTE' and event.entity_id = quote.id
         and event.event_type = 'QUOTE_ISSUED'
        where quote.id = ${source.sourceId}::uuid
          and quote.customer_id = ${source.customerId}::uuid
          and quote.quote_reference = ${source.sourceReference}
          and quote.status in ('ISSUED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN')
          and quote.acceptance_source_snapshot #>> '{quote,recordVersion}' =
            ${source.sourceVersion}::text
          and ${permission}
      )`;
    case "BOOKING": {
      const auditType =
        source.eventType === "BOOKING_CONFIRMED"
          ? "BOOKING_SCHEDULED"
          : source.eventType;
      const occupancy =
        source.eventType === "BOOKING_CANCELLED"
          ? sql`${source.bookingOccupancyId}::uuid is null`
          : sql`exists (
              select 1 from ${bookingOccupancies} occupancy
              where occupancy.id = ${source.bookingOccupancyId}::uuid
                and occupancy.booking_id = booking.id
                and occupancy.status = 'CONFIRMED'
                and occupancy.snapshot_version::text =
                  event.safe_metadata ->> 'occupancySnapshotVersion'
            )`;
      const status =
        source.eventType === "BOOKING_CANCELLED"
          ? sql`booking.status = 'CANCELLED'`
          : sql`booking.status = 'CONFIRMED'
              and booking.scheduling_status = 'SCHEDULED'`;
      const eventVersion =
        source.eventType === "BOOKING_CANCELLED"
          ? sql`true`
          : sql`event.safe_metadata ->> 'bookingVersion' =
              ${source.sourceVersion}::text`;
      return sql`exists (
        select 1 from ${bookings} booking
        join ${bookingAuditEvents} event
          on event.id = ${source.bookingAuditEventId}::uuid
         and event.booking_id = booking.id and event.event_type = ${auditType}
        where booking.id = ${source.sourceId}::uuid
          and booking.customer_id = ${source.customerId}::uuid
          and booking.booking_reference = ${source.sourceReference}
          and booking.version = ${source.sourceVersion}
          and ${eventVersion} and ${status} and ${occupancy} and ${permission}
      )`;
    }
    case "JOB": {
      const passportIntegrity =
        input.documentType === "CLEANING_PASSPORT"
          ? sql`pg_input_is_valid(
                event.safe_metadata ->> 'passportEntryCount', 'integer')
              and (event.safe_metadata ->> 'passportEntryCount')::integer = (
                select count(*)::integer
                from ${cleaningPassportEntries} passport_entry
                where passport_entry.job_id = job.id
                  and passport_entry.source_execution_status = 'COMPLETED'
                  and passport_entry.customer_safe_snapshot
                    ->> 'schemaVersion' = '1'
              )`
          : sql`true`;
      return sql`exists (
        select 1 from ${jobs} job
        join ${jobAuditEvents} event
          on event.id = ${source.jobAuditEventId}::uuid
         and event.job_id = job.id and event.event_type = 'JOB_COMPLETED'
        where job.id = ${source.sourceId}::uuid
          and job.customer_id = ${source.customerId}::uuid
          and job.job_reference = ${source.sourceReference}
          and job.version = ${source.sourceVersion}
          and job.status = 'COMPLETED'
          and job.completion_snapshot ->> 'schemaVersion' = '1'
          and ${passportIntegrity} and ${permission}
      )`;
    }
    case "INVOICE":
      return sql`exists (
        select 1 from ${invoices} invoice
        join ${financeAuditEvents} event
          on event.id = ${source.financeAuditEventId}::uuid
         and event.invoice_id = invoice.id and event.event_type = 'INVOICE_ISSUED'
        where invoice.id = ${source.sourceId}::uuid
          and invoice.customer_id = ${source.customerId}::uuid
          and invoice.invoice_reference = ${source.sourceReference}
          and event.safe_metadata ->> 'invoiceVersion' = ${source.sourceVersion}::text
          and invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          and invoice.finance_review_status = 'CLEAR'
          and ${permission}
      )`;
    case "PAYMENT":
      return sql`exists (
        select 1 from ${payments} payment
        join ${financeAuditEvents} event
          on event.id = ${source.financeAuditEventId}::uuid
         and event.payment_id = payment.id
         and event.event_type = ${source.eventType}
        where payment.id = ${source.sourceId}::uuid
          and payment.customer_id = ${source.customerId}::uuid
          and payment.payment_reference = ${source.sourceReference}
          and event.safe_metadata ->> 'paymentVersion' = ${source.sourceVersion}::text
          and payment.status = case when ${source.eventType} = 'PAYMENT_CONFIRMED'
            then 'CONFIRMED' else 'REVERSED' end
          and ${permission}
      )`;
  }
}

function contactRecheckSql(input: PersistCommunicationInput): SQL {
  if (!input.contact) return sql`${input.channel} = 'PORTAL'`;
  return sql`exists (
    select 1 from ${customerContacts} contact
    where contact.id = ${input.contact.contactId}::uuid
      and contact.customer_id = ${input.source.customerId}::uuid
      and contact.active = true
      and contact.version = ${input.contact.version}
      and contact.contact_name = ${input.contact.contactName}
      and contact.locale = ${input.contact.locale}
      and contact.email is not distinct from ${input.contact.email}
      and contact.phone is not distinct from ${input.contact.phone}
      and (${input.channel} <> 'EMAIL_FUTURE' or contact.email is not null)
      and (${input.channel} <> 'SMS_FUTURE' or contact.phone is not null)
  )`;
}

function preferenceRecheckSql(input: PersistCommunicationInput): SQL {
  const channelColumn =
    input.channel === "PORTAL"
      ? sql`coalesce(preference.portal_enabled, true)`
      : input.channel === "EMAIL_FUTURE"
        ? sql`coalesce(preference.email_future_enabled, false)`
        : sql`coalesce(preference.sms_future_enabled, false)`;
  const purposeColumn =
    input.source.purpose === "OPERATIONAL"
      ? sql`coalesce(preference.operational_allowed, true)`
      : sql`coalesce(preference.billing_allowed, true)`;
  return sql`exists (
    select 1 from ${customers} customer
    left join ${customerCommunicationPreferences} preference
      on preference.customer_id = customer.id
    where customer.id = ${input.source.customerId}::uuid
      and customer.status = 'ACTIVE'
      and ${channelColumn} and ${purposeColumn}
  )`;
}

export async function resolveDeliveryContext(
  database: Database,
  actorProfileId: string,
  source: ResolvedCommunicationSource,
  input: Readonly<{
    channel: Exclude<CommunicationChannel, "MANUAL">;
    contactId: string | null;
  }>,
): Promise<ResolvedDeliveryContext | null> {
  const result = await database.execute<ContextRow>(sql`
    with selected as materialized (
      select customer.id as customer_id,
        coalesce(preference.portal_enabled, true) as portal_enabled,
        coalesce(preference.email_future_enabled, false)
          as email_future_enabled,
        coalesce(preference.sms_future_enabled, false) as sms_future_enabled,
        coalesce(preference.operational_allowed, true) as operational_allowed,
        coalesce(preference.billing_allowed, true) as billing_allowed,
        coalesce(preference.marketing_consent, false) as marketing_consent,
        coalesce(preference.preferred_locale,
          ${source.localeHint}) as preference_locale,
        coalesce(preference.version, 0) as preference_version,
        contact.id as contact_id, contact.contact_name,
        contact.email, contact.phone, contact.locale as contact_locale,
        contact.version as contact_version,
        coalesce(contact.locale, preference.preferred_locale,
          ${source.localeHint}) as effective_locale
      from ${customers} customer
      left join ${customerCommunicationPreferences} preference
        on preference.customer_id = customer.id
      left join ${customerContacts} contact
        on contact.id = ${input.contactId}::uuid
       and contact.customer_id = customer.id and contact.active = true
      where customer.id = ${source.customerId}::uuid
        and customer.status = 'ACTIVE'
        and ((${input.contactId}::uuid is null and ${input.channel} = 'PORTAL')
          or (contact.id is not null
            and (${input.channel} <> 'EMAIL_FUTURE' or contact.email is not null)
            and (${input.channel} <> 'SMS_FUTURE' or contact.phone is not null)))
        and ${staffPermissionSql(actorProfileId, source.eventType, true)}
    )
    select selected.portal_enabled as "portalEnabled",
      selected.email_future_enabled as "emailFutureEnabled",
      selected.sms_future_enabled as "smsFutureEnabled",
      selected.operational_allowed as "operationalAllowed",
      selected.billing_allowed as "billingAllowed",
      selected.marketing_consent as "marketingConsent",
      selected.preference_locale as "preferredLocale",
      selected.preference_version as "preferenceVersion",
      selected.contact_id as "contactId",
      selected.contact_name as "contactName",
      selected.email as "contactEmail", selected.phone as "contactPhone",
      selected.contact_locale as "contactLocale",
      selected.contact_version as "contactVersion",
      template.template_key as "templateKey",
      template.version as "templateVersion",
      template.locale as "templateLocale",
      template.document_type as "documentType",
      template.title_template as "titleTemplate",
      template.body_template as "bodyTemplate",
      template.variables_contract as "variablesContract",
      template.status as "templateStatus"
    from selected
    join ${communicationTemplates} template
      on template.template_key = ${source.templateKey}
     and template.locale = selected.effective_locale
     and template.document_type = ${source.documentType}
     and template.status = 'ACTIVE'
    limit 1
  `);
  const row = result.rows[0];
  if (!row) return null;
  const contract = strings(row.variablesContract);
  if (contract.length === 0) return null;
  const preferences: CommunicationPreferences = {
    portalEnabled: row.portalEnabled,
    emailFutureEnabled: row.emailFutureEnabled,
    smsFutureEnabled: row.smsFutureEnabled,
    operationalAllowed: row.operationalAllowed,
    billingAllowed: row.billingAllowed,
    marketingConsent: row.marketingConsent,
    preferredLocale: row.preferredLocale,
    version: row.preferenceVersion,
  };
  const contact: SelectedContactSnapshot | null = row.contactId
    ? {
        contactId: row.contactId,
        contactName: row.contactName ?? "",
        email: row.contactEmail,
        phone: row.contactPhone,
        locale: row.contactLocale ?? row.templateLocale,
        version: row.contactVersion ?? 0,
      }
    : null;
  if (contact && (contact.contactName.length === 0 || contact.version < 1)) {
    return null;
  }
  const template: CommunicationTemplateRecord = {
    templateKey: row.templateKey,
    version: row.templateVersion,
    locale: row.templateLocale,
    documentType: row.documentType,
    titleTemplate: row.titleTemplate,
    bodyTemplate: row.bodyTemplate,
    variablesContract: contract,
    status: "ACTIVE",
  };
  return { preferences, contact, locale: row.templateLocale, template };
}

function mutationResult(row: MutationRow | undefined): CommunicationMutationResult {
  if (!row) return { status: "REVIEW_REQUIRED" };
  if (row.result === "CREATED" || row.result === "EXISTING") {
    if (
      row.communicationReference &&
      row.documentReference &&
      (row.intentStatus === "DELIVERED_LOCAL" ||
        row.intentStatus === "QUEUED_FUTURE")
    ) {
      return {
        status: row.result,
        communicationReference: row.communicationReference,
        documentReference: row.documentReference,
        intentStatus: row.intentStatus,
      };
    }
    return { status: "REVIEW_REQUIRED" };
  }
  if (
    row.result === "NOT_FOUND_OR_FORBIDDEN" ||
    row.result === "PREFERENCE_BLOCKED" ||
    row.result === "REVIEW_REQUIRED" ||
    row.result === "REFERENCE_CONFLICT" ||
    row.result === "IDEMPOTENCY_CONFLICT"
  ) {
    return { status: row.result };
  }
  return { status: "REVIEW_REQUIRED" };
}

async function existingCommunication(
  database: Database,
  actorProfileId: string,
  input: PersistCommunicationInput,
): Promise<CommunicationMutationResult | null> {
  const result = await database.execute<MutationRow>(sql`
    select 'EXISTING'::text as result,
      intent.communication_reference as "communicationReference",
      document.document_reference as "documentReference",
      intent.status as "intentStatus",
      intent.idempotency_fingerprint as "idempotencyFingerprint"
    from ${communicationIntents} intent
    join ${documents} document on document.communication_intent_id = intent.id
    where (intent.idempotency_key = ${input.idempotencyKey}::uuid
        or (${sourceAuditColumn(input)}
          and intent.channel = ${input.channel}
          and intent.template_key = ${input.template.templateKey}
          and intent.template_version = ${input.template.version}))
      and ${staffPermissionSql(actorProfileId, input.source.eventType, false)}
    order by
      (intent.idempotency_fingerprint <> ${input.idempotencyFingerprint}) desc,
      (intent.idempotency_key = ${input.idempotencyKey}::uuid) desc
    limit 1
  `);
  const row = result.rows[0];
  if (!row) return null;
  if (row.idempotencyFingerprint !== input.idempotencyFingerprint) {
    return { status: "IDEMPOTENCY_CONFLICT" };
  }
  return mutationResult(row);
}

export async function persistCommunication(
  database: Database,
  input: PersistCommunicationInput,
): Promise<CommunicationMutationResult> {
  const source = input.source;
  const contactSnapshot = input.contact
    ? json({
        schemaVersion: 1,
        contactName: input.contact.contactName,
        email: input.contact.email,
        phone: input.contact.phone,
        locale: input.contact.locale,
        contactVersion: input.contact.version,
      })
    : null;
  const payloadSnapshot = json({
    ...source.sourcePayload,
    documentType: input.documentType,
    eventType: source.eventType,
    sourceReference: source.sourceReference,
    sourceVersion: source.sourceVersion,
  });
  const contentSnapshot = json(input.content);
  const variablesContract = json(input.template.variablesContract);
  const quoteId = source.sourceType === "QUOTE" ? source.sourceId : null;
  const bookingId = source.sourceType === "BOOKING" ? source.sourceId : null;
  const jobId = source.sourceType === "JOB" ? source.sourceId : null;
  const invoiceId = source.sourceType === "INVOICE" ? source.sourceId : null;
  const paymentId = source.sourceType === "PAYMENT" ? source.sourceId : null;

  try {
    const result = await database.execute<MutationRow>(sql`
      with existing_key as materialized (
        select intent.*, document.document_reference
        from ${communicationIntents} intent
        left join ${documents} document
          on document.communication_intent_id = intent.id
        where intent.idempotency_key = ${input.idempotencyKey}::uuid
        limit 1
      ),
      existing_event as materialized (
        select intent.*, document.document_reference
        from ${communicationIntents} intent
        left join ${documents} document
          on document.communication_intent_id = intent.id
        where ${sourceAuditColumn(input)}
          and intent.channel = ${input.channel}
          and intent.template_key = ${input.template.templateKey}
          and intent.template_version = ${input.template.version}
        limit 1
      ),
      decision as materialized (
        select case
          when exists (select 1 from existing_key
            where idempotency_fingerprint <> ${input.idempotencyFingerprint})
            then 'IDEMPOTENCY_CONFLICT'
          when exists (select 1 from existing_event
            where idempotency_fingerprint <> ${input.idempotencyFingerprint})
            then 'IDEMPOTENCY_CONFLICT'
          when exists (select 1 from existing_key) then 'EXISTING_KEY'
          when exists (select 1 from existing_event) then 'EXISTING_EVENT'
          when not (${sourceRecheckSql(input)}) then 'REVIEW_REQUIRED'
          when not (${contactRecheckSql(input)})
            then 'NOT_FOUND_OR_FORBIDDEN'
          when not (${preferenceRecheckSql(input)}) then 'PREFERENCE_BLOCKED'
          when not exists (
            select 1 from ${communicationTemplates} template
            where template.template_key = ${input.template.templateKey}
              and template.version = ${input.template.version}
              and template.locale = ${input.locale}
              and template.document_type = ${input.documentType}
              and template.status = 'ACTIVE'
              and template.title_template = ${input.template.titleTemplate}
              and template.body_template = ${input.template.bodyTemplate}
              and template.variables_contract = ${variablesContract}::jsonb
          ) then 'REVIEW_REQUIRED'
          else 'CREATE'
        end as result
      ),
      inserted_intent as (
        insert into ${communicationIntents} (
          communication_reference, customer_id, contact_id,
          source_type, source_reference, source_version,
          quote_id, booking_id, booking_occupancy_id, job_id,
          invoice_id, payment_id, business_audit_event_id,
          booking_audit_event_id, job_audit_event_id,
          finance_audit_event_id, event_type, purpose, channel, locale,
          status, template_key, template_version, payload_snapshot,
          contact_snapshot, idempotency_key, idempotency_fingerprint,
          created_by_profile_id, ready_at, delivered_local_at
        )
        select ${input.communicationReference}, ${source.customerId}::uuid,
          ${input.contact?.contactId ?? null}::uuid,
          ${source.sourceType}, ${source.sourceReference},
          ${source.sourceVersion}, ${quoteId}::uuid, ${bookingId}::uuid,
          ${source.bookingOccupancyId}::uuid, ${jobId}::uuid,
          ${invoiceId}::uuid, ${paymentId}::uuid,
          ${source.businessAuditEventId}::uuid,
          ${source.bookingAuditEventId}::uuid,
          ${source.jobAuditEventId}::uuid,
          ${source.financeAuditEventId}::uuid,
          ${source.eventType}, ${source.purpose}, ${input.channel},
          ${input.locale}, ${input.intentStatus},
          ${input.template.templateKey}, ${input.template.version},
          ${payloadSnapshot}::jsonb, ${contactSnapshot}::jsonb,
          ${input.idempotencyKey}::uuid, ${input.idempotencyFingerprint},
          ${input.actorProfileId}::uuid, now(),
          case when ${input.channel} = 'PORTAL' then now() end
        from decision where decision.result = 'CREATE'
        returning *
      ),
      inserted_document as (
        insert into ${documents} (
          document_reference, communication_intent_id, customer_id,
          document_type, document_version, source_type, source_reference,
          source_version, locale, template_key, template_version,
          renderer_version, title_snapshot, content_snapshot,
          rendered_format, status, checksum_sha256,
          created_by_profile_id, rendered_at, finalized_at
        )
        select ${input.documentReference}, intent.id, intent.customer_id,
          ${input.documentType}, 1, ${source.sourceType},
          ${source.sourceReference}, ${source.sourceVersion}, ${input.locale},
          ${input.template.templateKey}, ${input.template.version}, 1,
          ${input.content.title}, ${contentSnapshot}::jsonb, 'HTML_PRINT',
          'FINAL', ${input.checksumSha256}, ${input.actorProfileId}::uuid,
          now(), now()
        from inserted_intent intent
        returning *
      ),
      inserted_attempt as (
        insert into ${deliveryAttempts} (
          delivery_reference, communication_intent_id, document_id,
          customer_id, attempt_number, channel, adapter_key, status,
          idempotency_key, attempted_by_profile_id, started_at, completed_at
        )
        select ${input.deliveryReference}, intent.id, document.id,
          intent.customer_id, 1, 'PORTAL', 'PORTAL_LOCAL', 'COMPLETED',
          ${input.idempotencyKey}::uuid, ${input.actorProfileId}::uuid,
          now(), now()
        from inserted_intent intent
        join inserted_document document
          on document.communication_intent_id = intent.id
        where ${input.channel} = 'PORTAL'
        returning *
      ),
      inserted_result as (
        insert into ${deliveryResults} (
          delivery_attempt_id, customer_id, outcome, result_code,
          retryable, safe_evidence, completed_at
        )
        select attempt.id, attempt.customer_id, 'DELIVERED_LOCAL',
          'PORTAL_PUBLISHED', false,
          jsonb_build_object('scope', 'CUSTOMER_PORTAL'), now()
        from inserted_attempt attempt
        returning *
      ),
      inserted_history as (
        insert into ${customerCommunicationHistoryEntries} (
          history_reference, customer_id, communication_intent_id,
          document_id, delivery_result_id, event_type, locale,
          title_snapshot, visible_at
        )
        select ${input.historyReference}, intent.customer_id, intent.id,
          document.id, result.id, ${source.eventType}, ${input.locale},
          ${input.content.title}, now()
        from inserted_intent intent
        join inserted_document document
          on document.communication_intent_id = intent.id
        join inserted_attempt attempt
          on attempt.communication_intent_id = intent.id
        join inserted_result result
          on result.delivery_attempt_id = attempt.id
        returning *
      ),
      intent_audit as (
        insert into ${communicationAuditEvents} (
          customer_id, communication_intent_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select intent.customer_id, intent.id, 'INTENT_CREATED',
          ${input.actorProfileId}::uuid, 'STAFF', jsonb_build_object(
            'eventType', ${source.eventType}::text,
            'channel', ${input.channel}::text,
            'templateKey', ${input.template.templateKey}::text,
            'templateVersion', ${input.template.version}::integer
          ) from inserted_intent intent returning id
      ),
      rendered_audit as (
        insert into ${communicationAuditEvents} (
          customer_id, communication_intent_id, document_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select document.customer_id, document.communication_intent_id,
          document.id, 'DOCUMENT_RENDERED', ${input.actorProfileId}::uuid,
          'SYSTEM', jsonb_build_object(
            'documentType', ${input.documentType}::text,
            'rendererVersion', 1
          ) from inserted_document document returning id
      ),
      finalized_audit as (
        insert into ${communicationAuditEvents} (
          customer_id, communication_intent_id, document_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select document.customer_id, document.communication_intent_id,
          document.id, 'DOCUMENT_FINALIZED', ${input.actorProfileId}::uuid,
          'SYSTEM', jsonb_build_object(
            'documentType', ${input.documentType}::text
          ) from inserted_document document returning id
      ),
      delivery_audit as (
        insert into ${communicationAuditEvents} (
          customer_id, communication_intent_id, document_id,
          delivery_attempt_id, history_entry_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select intent.customer_id, intent.id, document.id, attempt.id,
          history.id, 'PORTAL_PUBLISHED', ${input.actorProfileId}::uuid,
          'SYSTEM', jsonb_build_object('resultCode', 'PORTAL_PUBLISHED')
        from inserted_intent intent
        join inserted_document document
          on document.communication_intent_id = intent.id
        join inserted_attempt attempt
          on attempt.communication_intent_id = intent.id
        join inserted_history history
          on history.communication_intent_id = intent.id
        returning id
      ),
      deferred_audit as (
        insert into ${communicationAuditEvents} (
          customer_id, communication_intent_id, document_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select intent.customer_id, intent.id, document.id,
          'FUTURE_CHANNEL_DEFERRED', ${input.actorProfileId}::uuid,
          'SYSTEM', jsonb_build_object(
            'channel', ${input.channel}::text,
            'reasonCode', 'PROVIDER_NOT_CONFIGURED'
          )
        from inserted_intent intent
        join inserted_document document
          on document.communication_intent_id = intent.id
        where ${input.channel} in ('EMAIL_FUTURE', 'SMS_FUTURE')
        returning id
      )
      select 'CREATED'::text as result,
        intent.communication_reference as "communicationReference",
        document.document_reference as "documentReference",
        intent.status as "intentStatus",
        intent.idempotency_fingerprint as "idempotencyFingerprint"
      from inserted_intent intent
      join inserted_document document
        on document.communication_intent_id = intent.id
      where exists (select 1 from intent_audit)
        and exists (select 1 from rendered_audit)
        and exists (select 1 from finalized_audit)
        and ((${input.channel} = 'PORTAL'
            and exists (select 1 from delivery_audit))
          or (${input.channel} in ('EMAIL_FUTURE', 'SMS_FUTURE')
            and exists (select 1 from deferred_audit)))
      union all
      select 'EXISTING'::text, existing_key.communication_reference,
        existing_key.document_reference, existing_key.status,
        existing_key.idempotency_fingerprint
      from existing_key, decision where decision.result = 'EXISTING_KEY'
      union all
      select 'EXISTING'::text, existing_event.communication_reference,
        existing_event.document_reference, existing_event.status,
        existing_event.idempotency_fingerprint
      from existing_event, decision where decision.result = 'EXISTING_EVENT'
      union all
      select decision.result, null::text, null::text, null::text, null::text
      from decision
      where decision.result not in ('CREATE', 'EXISTING_KEY', 'EXISTING_EVENT')
      limit 1
    `);
    return mutationResult(result.rows[0]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return (
      (await existingCommunication(database, input.actorProfileId, input)) ?? {
        status: "REFERENCE_CONFLICT",
      }
    );
  }
}

type StaffSummaryRow = StaffCommunicationSummary & { totalCount: number };

export async function listStaffCommunications(
  database: Database,
  actorProfileId: string,
  input: Readonly<{
    status?: CommunicationIntentStatus;
    limit: number;
    offset: number;
  }>,
): Promise<StaffCommunicationPage> {
  const statusFilter = input.status
    ? sql`${communicationIntents.status} = ${input.status}`
    : sql`true`;
  const result = await database.execute<StaffSummaryRow>(sql`
    select ${communicationIntents.communicationReference}
        as "communicationReference",
      ${documents.documentReference} as "documentReference",
      ${communicationIntents.eventType} as "eventType",
      ${documents.documentType} as "documentType",
      ${communicationIntents.sourceReference} as "sourceReference",
      ${communicationIntents.channel} as channel,
      ${communicationIntents.locale} as locale,
      ${communicationIntents.status} as status,
      ${documents.titleSnapshot} as title,
      ${communicationIntents.createdAt} as "createdAt",
      count(*) over()::integer as "totalCount"
    from ${communicationIntents}
    left join ${documents}
      on ${documents.communicationIntentId} = ${communicationIntents.id}
    where ${statusFilter} and ${staffRowReadSql(actorProfileId)}
    order by ${communicationIntents.createdAt} desc,
      ${communicationIntents.communicationReference}
    limit ${input.limit} offset ${input.offset}
  `);
  return {
    items: result.rows.map((row) => {
      const item = { ...row };
      delete (item as Partial<StaffSummaryRow>).totalCount;
      return item;
    }),
    total: result.rows[0]?.totalCount ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getStaffCommunication(
  database: Database,
  actorProfileId: string,
  communicationReference: string,
): Promise<StaffCommunicationDetail | null> {
  const result = await database.execute<StaffCommunicationDetail>(sql`
    select ${communicationIntents.communicationReference}
        as "communicationReference",
      ${documents.documentReference} as "documentReference",
      ${communicationIntents.eventType} as "eventType",
      ${documents.documentType} as "documentType",
      ${communicationIntents.sourceReference} as "sourceReference",
      ${communicationIntents.channel} as channel,
      ${communicationIntents.locale} as locale,
      ${communicationIntents.status} as status,
      ${documents.titleSnapshot} as title,
      ${communicationIntents.createdAt} as "createdAt",
      ${communicationIntents.sourceType} as "sourceType",
      ${communicationIntents.sourceVersion} as "sourceVersion",
      ${communicationIntents.purpose} as purpose,
      ${communicationIntents.templateKey} as "templateKey",
      ${communicationIntents.templateVersion} as "templateVersion",
      (${communicationIntents.contactId} is not null) as "contactSelected",
      ${documents.checksumSha256} as "checksumSha256",
      ${documents.status} as "documentStatus",
      ${documents.finalizedAt} as "finalizedAt"
    from ${communicationIntents}
    left join ${documents}
      on ${documents.communicationIntentId} = ${communicationIntents.id}
    where ${communicationIntents.communicationReference} =
        ${communicationReference}
      and ${staffRowReadSql(actorProfileId)}
    limit 1
  `);
  return result.rows[0] ?? null;
}

export async function listCustomerHistory(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerHistorySummary[]> {
  const result = await database.execute<CustomerHistorySummary>(sql`
    select history.history_reference as "historyReference",
      intent.communication_reference as "communicationReference",
      document.document_reference as "documentReference",
      intent.event_type as "eventType", document.document_type as "documentType",
      document.locale, history.title_snapshot as title,
      history.visible_at as "visibleAt",
      (document.status = 'SUPERSEDED') as superseded
    from ${customerCommunicationHistoryEntries} history
    join ${communicationIntents} intent
      on intent.id = history.communication_intent_id
     and intent.customer_id = history.customer_id
    join ${documents} document
      on document.id = history.document_id
     and document.customer_id = history.customer_id
    join ${deliveryResults} result
      on result.id = history.delivery_result_id
     and result.customer_id = history.customer_id
    where intent.status = 'DELIVERED_LOCAL'
      and intent.channel = 'PORTAL'
      and document.status in ('FINAL', 'SUPERSEDED')
      and result.outcome = 'DELIVERED_LOCAL'
      and result.result_code = 'PORTAL_PUBLISHED'
      and ${customerAccessSql(actorProfileId, sql`history.customer_id`)}
    order by history.visible_at desc, history.history_reference
  `);
  return result.rows;
}

export async function getCustomerDocument(
  database: Database,
  actorProfileId: string,
  documentReference: string,
): Promise<CustomerDocumentDetail | null> {
  type DocumentRow = Omit<CustomerDocumentDetail, "content"> & {
    content: unknown;
  };
  const result = await database.execute<DocumentRow>(sql`
    select document.document_reference as "documentReference",
      document.document_type as "documentType", document.locale,
      document.status, document.checksum_sha256 as "checksumSha256",
      document.finalized_at as "finalizedAt",
      document.content_snapshot as content
    from ${documents} document
    join ${communicationIntents} intent
      on intent.id = document.communication_intent_id
     and intent.customer_id = document.customer_id
    join ${customerCommunicationHistoryEntries} history
      on history.document_id = document.id
     and history.communication_intent_id = intent.id
     and history.customer_id = document.customer_id
    join ${deliveryResults} result
      on result.id = history.delivery_result_id
     and result.customer_id = history.customer_id
    where document.document_reference = ${documentReference}
      and document.status in ('FINAL', 'SUPERSEDED')
      and intent.status = 'DELIVERED_LOCAL' and intent.channel = 'PORTAL'
      and result.outcome = 'DELIVERED_LOCAL'
      and result.result_code = 'PORTAL_PUBLISHED'
      and ${customerAccessSql(actorProfileId, sql`document.customer_id`)}
    limit 1
  `);
  const row = result.rows[0];
  if (!row) return null;
  const content = documentContentSnapshotSchema.safeParse(row.content);
  if (!content.success || content.data.locale !== row.locale) return null;
  return { ...row, content: content.data } as CustomerDocumentDetail;
}

export async function getOwnCommunicationPreferences(
  database: Database,
  actorProfileId: string,
): Promise<CommunicationPreferences | null> {
  type PreferenceRow = CommunicationPreferences;
  const result = await database.execute<PreferenceRow>(sql`
    with exact_customer as materialized (
      select link.customer_id
      from ${customerIdentityLinks} link
      join ${customers} customer
        on customer.id = link.customer_id and customer.status = 'ACTIVE'
      where link.user_profile_id = ${actorProfileId}::uuid
        and link.active = true and link.revoked_at is null
        and ${activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ")}
    )
    select coalesce(preference.portal_enabled, true) as "portalEnabled",
      coalesce(preference.email_future_enabled, false) as "emailFutureEnabled",
      coalesce(preference.sms_future_enabled, false) as "smsFutureEnabled",
      coalesce(preference.operational_allowed, true) as "operationalAllowed",
      coalesce(preference.billing_allowed, true) as "billingAllowed",
      coalesce(preference.marketing_consent, false) as "marketingConsent",
      coalesce(preference.preferred_locale, customer.preferred_locale)
        as "preferredLocale",
      coalesce(preference.version, 0) as version
    from exact_customer exact
    join ${customers} customer on customer.id = exact.customer_id
    left join ${customerCommunicationPreferences} preference
      on preference.customer_id = exact.customer_id
    where (select count(*) from exact_customer) = 1
    limit 1
  `);
  return result.rows[0] ?? null;
}

export async function updateOwnCommunicationPreferences(
  database: Database,
  actorProfileId: string,
  input: UpdateCommunicationPreferencesInput,
): Promise<PreferencesMutationResult> {
  type PreferenceMutationRow = { result: string; version: number | null };
  const result = await database.execute<PreferenceMutationRow>(sql`
    with exact_customer as materialized (
      select link.customer_id
      from ${customerIdentityLinks} link
      join ${customers} customer
        on customer.id = link.customer_id and customer.status = 'ACTIVE'
      where link.user_profile_id = ${actorProfileId}::uuid
        and link.active = true and link.revoked_at is null
        and ${activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ")}
        and ${activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_UPDATE")}
    ),
    updated as (
      update ${customerCommunicationPreferences} preference
      set portal_enabled = ${input.portalEnabled},
        email_future_enabled = ${input.emailFutureEnabled},
        sms_future_enabled = ${input.smsFutureEnabled},
        operational_allowed = ${input.operationalAllowed},
        billing_allowed = ${input.billingAllowed},
        marketing_consent = ${input.marketingConsent},
        preferred_locale = ${input.preferredLocale},
        version = preference.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from exact_customer exact
      where preference.customer_id = exact.customer_id
        and (select count(*) from exact_customer) = 1
        and preference.version = ${input.expectedVersion}
      returning preference.customer_id, preference.version
    ),
    inserted as (
      insert into ${customerCommunicationPreferences} (
        customer_id, portal_enabled, email_future_enabled,
        sms_future_enabled, operational_allowed, billing_allowed,
        marketing_consent, preferred_locale, version,
        updated_by_profile_id
      )
      select exact.customer_id, ${input.portalEnabled},
        ${input.emailFutureEnabled}, ${input.smsFutureEnabled},
        ${input.operationalAllowed}, ${input.billingAllowed},
        ${input.marketingConsent}, ${input.preferredLocale}, 1,
        ${actorProfileId}::uuid
      from exact_customer exact
      where (select count(*) from exact_customer) = 1
        and ${input.expectedVersion} = 0
        and not exists (select 1 from ${customerCommunicationPreferences}
          existing where existing.customer_id = exact.customer_id)
      returning customer_id, version
    ),
    changed as materialized (
      select * from updated union all select * from inserted
    ),
    audited as (
      insert into ${communicationAuditEvents} (
        customer_id, event_type, actor_profile_id, source, safe_metadata
      )
      select changed.customer_id, 'PREFERENCES_UPDATED',
        ${actorProfileId}::uuid, 'CUSTOMER', jsonb_build_object(
          'preferenceVersion', changed.version,
          'marketingConsent', ${input.marketingConsent}
        )
      from changed returning id
    )
    select case when changed.customer_id is not null
          and exists (select 1 from audited) then 'UPDATED'
        when (select count(*) from exact_customer) <> 1
          then 'NOT_FOUND_OR_FORBIDDEN'
        else 'CONFLICT' end as result,
      changed.version
    from (select 1) singleton
    left join changed on true
  `);
  const row = result.rows[0];
  if (row?.result === "UPDATED" && row.version) {
    return { status: "UPDATED", version: row.version };
  }
  return {
    status:
      row?.result === "NOT_FOUND_OR_FORBIDDEN"
        ? "NOT_FOUND_OR_FORBIDDEN"
        : "CONFLICT",
  };
}

export function createDatabaseCommunicationsRepository(database: Database) {
  return {
    resolveSource: (
      actorProfileId: string,
      input: Readonly<{
        eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">;
        sourceReference: string;
        documentType: CommunicationDocumentType;
      }>,
    ) => resolveCommunicationSource(database, actorProfileId, input),
    resolveDeliveryContext: (
      actorProfileId: string,
      source: ResolvedCommunicationSource,
      input: Readonly<{
        channel: Exclude<CommunicationChannel, "MANUAL">;
        contactId: string | null;
      }>,
    ) => resolveDeliveryContext(database, actorProfileId, source, input),
    persist: (input: PersistCommunicationInput) =>
      persistCommunication(database, input),
    listStaff: (
      actorProfileId: string,
      input: Readonly<{
        status?: CommunicationIntentStatus;
        limit: number;
        offset: number;
      }>,
    ) => listStaffCommunications(database, actorProfileId, input),
    getStaff: (actorProfileId: string, reference: string) =>
      getStaffCommunication(database, actorProfileId, reference),
    listCustomerHistory: (actorProfileId: string) =>
      listCustomerHistory(database, actorProfileId),
    getCustomerDocument: (actorProfileId: string, reference: string) =>
      getCustomerDocument(database, actorProfileId, reference),
    getOwnPreferences: (actorProfileId: string) =>
      getOwnCommunicationPreferences(database, actorProfileId),
    updateOwnPreferences: (
      actorProfileId: string,
      input: UpdateCommunicationPreferencesInput,
    ) => updateOwnCommunicationPreferences(database, actorProfileId, input),
  };
}

export type DatabaseCommunicationsRepository = ReturnType<
  typeof createDatabaseCommunicationsRepository
>;

export const communicationsRepositorySqlForTesting = {
  staffRowReadSql,
  customerAccessSql,
  sourceRecheckSql,
  contactRecheckSql,
  preferenceRecheckSql,
};
