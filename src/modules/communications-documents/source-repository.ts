import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  bookingAuditEvents,
  bookingItems,
  bookingOccupancies,
  bookings,
} from "@/db/schema/booking-engine";
import { customers } from "@/db/schema/customer-crm";
import {
  financeAuditEvents,
  invoiceItems,
  invoices,
  payments,
} from "@/db/schema/finance-invoicing";
import {
  cleaningPassportEntries,
  jobAuditEvents,
  jobItems,
  jobs,
} from "@/db/schema/job-execution";
import {
  businessAuditEvents,
  quotes,
} from "@/db/schema/request-quote";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import type { PermissionCode } from "@/modules/identity-access/policy";
import { sourcePermissions } from "./policy";
import {
  projectCommunicationSource,
  type RawCommunicationSourceRow,
} from "./source-projection";
import type {
  CommunicationDocumentType,
  CommunicationEventType,
  ResolvedCommunicationSource,
} from "./types";

function staffSourcePermissionSql(
  actorProfileId: string,
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
): SQL {
  const permissions: readonly PermissionCode[] = [
    "COMMUNICATIONS_READ",
    "COMMUNICATIONS_MANAGE",
    ...sourcePermissions(eventType),
  ];
  return sql.join(
    permissions.map((permission) =>
      activeActorPermissionSql(actorProfileId, permission),
    ),
    sql` and `,
  );
}

function quoteSourceSql(
  actorProfileId: string,
  sourceReference: string,
): SQL {
  return sql`
    select 'QUOTE'::text as "sourceType", quote.id as "sourceId",
      quote.quote_reference as "sourceReference",
      (quote.acceptance_source_snapshot #>> '{quote,recordVersion}')::integer
        as "sourceVersion",
      quote.customer_id as "customerId",
      null::uuid as "bookingOccupancyId",
      event.id as "businessAuditEventId",
      null::uuid as "bookingAuditEventId",
      null::uuid as "jobAuditEventId",
      null::uuid as "financeAuditEventId",
      event.created_at as "occurredAt",
      coalesce(quote.acceptance_source_snapshot
        #>> '{customer,preferredLocale}', 'bg') as "localeHint",
      jsonb_build_object(
        'sourceSnapshotChecksumSha256',
          encode(sha256(convert_to(quote.acceptance_source_snapshot::text,
            'UTF8')), 'hex'),
        'sourceAuditEventType', event.event_type,
        'customerName', quote.acceptance_source_snapshot
          #>> '{customer,displayName}',
        'propertyLabel', quote.acceptance_source_snapshot
          #>> '{property,label}',
        'issuedAt', quote.acceptance_source_snapshot
          #>> '{quote,issuedAt}',
        'validUntil', quote.acceptance_source_snapshot
          #>> '{quote,validUntil}',
        'grossAmountMinorUnits',
          (quote.acceptance_source_snapshot
            #>> '{quote,grossTotalMinorUnits}')::integer,
        'lineItems', coalesce((
          select jsonb_agg(jsonb_build_object(
            'descriptionBg', item.value ->> 'descriptionBg',
            'descriptionEn', item.value ->> 'descriptionEn',
            'quantity', (item.value ->> 'quantity')::integer,
            'amountMinorUnits',
              (item.value ->> 'grossTotalMinorUnits')::integer
          ) order by (item.value ->> 'sortOrder')::integer)
          from jsonb_array_elements(
            quote.acceptance_source_snapshot -> 'quoteItems'
          ) item(value)
        ), '[]'::jsonb),
        'totals', jsonb_build_object(
          'netAmountMinorUnits',
            (quote.acceptance_source_snapshot
              #>> '{quote,netAmountMinorUnits}')::integer,
          'vatAmountMinorUnits',
            (quote.acceptance_source_snapshot
              #>> '{quote,vatAmountMinorUnits}')::integer,
          'grossAmountMinorUnits',
            (quote.acceptance_source_snapshot
              #>> '{quote,grossTotalMinorUnits}')::integer
        )
      ) as payload
    from ${quotes} quote
    join ${businessAuditEvents} event
      on event.entity_type = 'QUOTE'
     and event.entity_id = quote.id
     and event.event_type = 'QUOTE_ISSUED'
    where quote.quote_reference = ${sourceReference}
      and quote.status in ('ISSUED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN')
      and quote.issued_at is not null
      and quote.acceptance_source_snapshot is not null
      and quote.acceptance_source_snapshot #>> '{schemaVersion}' = '1'
      and quote.acceptance_source_snapshot #>> '{quote,id}' = quote.id::text
      and quote.acceptance_source_snapshot #>> '{quote,customerId}' =
        quote.customer_id::text
      and jsonb_typeof(quote.acceptance_source_snapshot -> 'quoteItems') =
        'array'
      and ${staffSourcePermissionSql(actorProfileId, "QUOTE_ISSUED")}
    order by event.created_at desc, event.id desc
    limit 1
  `;
}

function bookingSourceSql(
  actorProfileId: string,
  eventType: "BOOKING_CONFIRMED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED",
  sourceReference: string,
): SQL {
  const auditType =
    eventType === "BOOKING_CONFIRMED"
      ? "BOOKING_SCHEDULED"
      : eventType === "BOOKING_RESCHEDULED"
        ? "BOOKING_RESCHEDULED"
        : "BOOKING_CANCELLED";
  const scheduled = eventType !== "BOOKING_CANCELLED";
  const eventStatus = scheduled
    ? sql`booking.status = 'CONFIRMED'
        and booking.scheduling_status = 'SCHEDULED'
        and occupancy.status = 'CONFIRMED'
        and pg_input_is_valid(event.safe_metadata ->> 'bookingVersion',
          'integer')
        and booking.version::text = event.safe_metadata
          ->> 'bookingVersion'
        and occupancy.id::text = booking.scheduling_snapshot
          #>> '{occupancyId}'
        and occupancy.snapshot_version::text = event.safe_metadata
          ->> 'occupancySnapshotVersion'`
    : sql`booking.status = 'CANCELLED' and booking.cancelled_at is not null`;

  return sql`
    select 'BOOKING'::text as "sourceType", booking.id as "sourceId",
      booking.booking_reference as "sourceReference",
      ${scheduled
        ? sql`(event.safe_metadata ->> 'bookingVersion')::integer`
        : sql`booking.version`} as "sourceVersion",
      booking.customer_id as "customerId",
      ${scheduled ? sql`occupancy.id` : sql`null::uuid`}
        as "bookingOccupancyId",
      null::uuid as "businessAuditEventId",
      event.id as "bookingAuditEventId",
      null::uuid as "jobAuditEventId",
      null::uuid as "financeAuditEventId",
      event.created_at as "occurredAt",
      coalesce(booking.customer_snapshot ->> 'preferredLocale', 'bg')
        as "localeHint",
      jsonb_build_object(
        'sourceSnapshotChecksumSha256', encode(sha256(convert_to(
          jsonb_build_object(
            'customer', booking.customer_snapshot,
            'property', booking.property_snapshot,
            'price', booking.price_snapshot,
            'schedule', case when ${scheduled}
              then to_jsonb(occupancy) else to_jsonb(booking) end,
            'items', coalesce((select jsonb_agg(to_jsonb(item)
              order by item.sort_order, item.id)
              from ${bookingItems} item
              where item.booking_id = booking.id), '[]'::jsonb)
          )::text, 'UTF8')), 'hex'),
        'sourceAuditEventType', event.event_type,
        'customerName', booking.customer_snapshot ->> 'displayName',
        'propertyLabel', booking.property_snapshot ->> 'label',
        'serviceStart', ${scheduled
          ? sql`occupancy.service_start`
          : sql`null::timestamptz`},
        'serviceEnd', ${scheduled
          ? sql`occupancy.service_end`
          : sql`null::timestamptz`},
        'lineItems', coalesce((
          select jsonb_agg(jsonb_build_object(
            'descriptionBg', item.description_bg,
            'descriptionEn', item.description_en,
            'quantity', item.quantity,
            'amountMinorUnits', item.gross_total_minor_units
          ) order by item.sort_order, item.id)
          from ${bookingItems} item where item.booking_id = booking.id
        ), '[]'::jsonb),
        'totals', jsonb_build_object(
          'netAmountMinorUnits', coalesce((select sum(item.net_amount_minor_units)
            from ${bookingItems} item where item.booking_id = booking.id), 0),
          'vatAmountMinorUnits', coalesce((select sum(item.vat_amount_minor_units)
            from ${bookingItems} item where item.booking_id = booking.id), 0),
          'grossAmountMinorUnits', coalesce((select sum(item.gross_total_minor_units)
            from ${bookingItems} item where item.booking_id = booking.id), 0)
        )
      ) as payload
    from ${bookings} booking
    join ${bookingAuditEvents} event
      on event.booking_id = booking.id and event.event_type = ${auditType}
    left join ${bookingOccupancies} occupancy
      on occupancy.booking_id = booking.id
     and occupancy.snapshot_version = case when
       pg_input_is_valid(event.safe_metadata ->> 'occupancySnapshotVersion',
         'integer')
       then (event.safe_metadata ->> 'occupancySnapshotVersion')::integer end
    where booking.booking_reference = ${sourceReference}
      and booking.customer_snapshot ->> 'schemaVersion' = '1'
      and booking.property_snapshot ->> 'schemaVersion' = '1'
      and ${eventStatus}
      and ${staffSourcePermissionSql(actorProfileId, eventType)}
    order by event.created_at desc, event.id desc
    limit 1
  `;
}

function jobSourceSql(
  actorProfileId: string,
  sourceReference: string,
  documentType: CommunicationDocumentType,
): SQL {
  const passport = documentType === "CLEANING_PASSPORT";
  const auditType = "JOB_COMPLETED";
  const passportIntegrity = passport
    ? sql`pg_input_is_valid(event.safe_metadata ->> 'passportEntryCount',
          'integer')
        and (event.safe_metadata ->> 'passportEntryCount')::integer = (
          select count(*)::integer
          from ${cleaningPassportEntries} passport_entry
          where passport_entry.job_id = job.id
            and passport_entry.source_execution_status = 'COMPLETED'
            and passport_entry.customer_safe_snapshot
              ->> 'schemaVersion' = '1'
        )`
    : sql`true`;
  return sql`
    select 'JOB'::text as "sourceType", job.id as "sourceId",
      job.job_reference as "sourceReference", job.version as "sourceVersion",
      job.customer_id as "customerId", null::uuid as "bookingOccupancyId",
      null::uuid as "businessAuditEventId",
      null::uuid as "bookingAuditEventId",
      event.id as "jobAuditEventId",
      null::uuid as "financeAuditEventId",
      event.created_at as "occurredAt",
      coalesce(booking.customer_snapshot ->> 'preferredLocale', 'bg')
        as "localeHint",
      jsonb_build_object(
        'sourceSnapshotChecksumSha256', encode(sha256(convert_to(
          jsonb_build_object(
            'completion', job.completion_snapshot,
            'source', job.source_provenance_snapshot,
            'customerVisibleCompletionNotes',
              job.customer_visible_completion_notes,
            'passportEntries', coalesce((select jsonb_agg(
                passport_entry.customer_safe_snapshot
                order by passport_entry.completed_at, passport_entry.id)
              from ${cleaningPassportEntries} passport_entry
              where passport_entry.job_id = job.id), '[]'::jsonb)
          )::text, 'UTF8')), 'hex'),
        'sourceAuditEventType', event.event_type,
        'customerName', job.source_provenance_snapshot
          ->> 'customerDisplayName',
        'completedAt', job.completed_at,
        'lineItems', coalesce((
          select jsonb_agg(jsonb_build_object(
            'descriptionBg', item.customer_visible_description_bg,
            'descriptionEn', item.customer_visible_description_en,
            'quantity', item.quantity
          ) order by item.sort_order, item.id)
          from ${jobItems} item where item.job_id = job.id
            and item.status in ('COMPLETED', 'DECLINED', 'REFERRED')
        ), '[]'::jsonb),
        'passportEntries', coalesce((
          select jsonb_agg(jsonb_build_object(
            'descriptionBg', passport_entry.customer_safe_snapshot
              ->> 'serviceDescriptionBg',
            'descriptionEn', passport_entry.customer_safe_snapshot
              ->> 'serviceDescriptionEn',
            'quantity', 1
          ) order by passport_entry.completed_at, passport_entry.id)
          from ${cleaningPassportEntries} passport_entry
          where passport_entry.job_id = job.id
            and passport_entry.source_execution_status = 'COMPLETED'
            and passport_entry.customer_safe_snapshot
              ->> 'schemaVersion' = '1'
        ), '[]'::jsonb),
        'notices', to_jsonb(array_remove(array[
          job.customer_visible_completion_notes,
          job.completion_snapshot ->> 'customerVisibleCareNotes'
        ]::text[], null))
      ) as payload
    from ${jobs} job
    join ${bookings} booking on booking.id = job.booking_id
    join ${jobAuditEvents} event
      on event.job_id = job.id and event.event_type = ${auditType}
    where job.job_reference = ${sourceReference}
      and job.status = 'COMPLETED' and job.completed_at is not null
      and job.completion_snapshot ->> 'schemaVersion' = '1'
      and job.source_provenance_snapshot ->> 'customerDisplayName' is not null
      and ${passportIntegrity}
      and ${staffSourcePermissionSql(actorProfileId, "JOB_COMPLETED")}
    order by event.created_at asc, event.id asc
    limit 1
  `;
}

function invoiceSourceSql(
  actorProfileId: string,
  sourceReference: string,
): SQL {
  return sql`
    select 'INVOICE'::text as "sourceType", invoice.id as "sourceId",
      invoice.invoice_reference as "sourceReference",
      (event.safe_metadata ->> 'invoiceVersion')::integer as "sourceVersion",
      invoice.customer_id as "customerId", null::uuid as "bookingOccupancyId",
      null::uuid as "businessAuditEventId",
      null::uuid as "bookingAuditEventId",
      null::uuid as "jobAuditEventId",
      event.id as "financeAuditEventId", event.created_at as "occurredAt",
      coalesce(customer.preferred_locale, 'bg') as "localeHint",
      jsonb_build_object(
        'sourceSnapshotChecksumSha256', encode(sha256(convert_to(
          jsonb_build_object(
            'invoiceNumber', invoice.invoice_number,
            'issueDate', invoice.issue_date,
            'dueDate', invoice.due_date,
            'customer', invoice.customer_snapshot,
            'seller', invoice.seller_snapshot,
            'commercial', invoice.commercial_snapshot,
            'terms', invoice.terms_snapshot,
            'items', coalesce((select jsonb_agg(to_jsonb(item)
              order by item.sort_order, item.id)
              from ${invoiceItems} item
              where item.invoice_id = invoice.id), '[]'::jsonb)
          )::text, 'UTF8')), 'hex'),
        'sourceAuditEventType', event.event_type,
        'customerName', invoice.customer_snapshot ->> 'billingName',
        'invoiceNumber', invoice.invoice_number,
        'dueDate', invoice.due_date,
        'grossAmountMinorUnits', invoice.gross_total_minor_units,
        'lineItems', coalesce((select jsonb_agg(jsonb_build_object(
          'descriptionBg', item.description_bg,
          'descriptionEn', item.description_en,
          'quantity', item.quantity,
          'amountMinorUnits', item.gross_total_minor_units
        ) order by item.sort_order, item.id)
          from ${invoiceItems} item where item.invoice_id = invoice.id),
          '[]'::jsonb),
        'totals', jsonb_build_object(
          'netAmountMinorUnits', invoice.net_amount_minor_units,
          'vatAmountMinorUnits', invoice.vat_amount_minor_units,
          'grossAmountMinorUnits', invoice.gross_total_minor_units,
          'paidAmountMinorUnits', 0,
          'outstandingAmountMinorUnits', invoice.gross_total_minor_units
        ),
        'notices', to_jsonb(array_remove(array[
          invoice.customer_visible_notes,
          invoice.seller_snapshot ->> 'paymentInstructions'
        ]::text[], null))
      ) as payload
    from ${invoices} invoice
    join ${customers} customer on customer.id = invoice.customer_id
    join ${financeAuditEvents} event
      on event.invoice_id = invoice.id and event.event_type = 'INVOICE_ISSUED'
    where invoice.invoice_reference = ${sourceReference}
      and invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
      and invoice.finance_review_status = 'CLEAR'
      and invoice.invoice_number is not null and invoice.issued_at is not null
      and invoice.issue_date is not null and invoice.due_date is not null
      and length(trim(coalesce(invoice.customer_snapshot
        ->> 'billingName', ''))) > 0
      and pg_input_is_valid(event.safe_metadata ->> 'invoiceVersion', 'integer')
      and ${staffSourcePermissionSql(actorProfileId, "INVOICE_ISSUED")}
    order by event.created_at desc, event.id desc
    limit 1
  `;
}

function paymentSourceSql(
  actorProfileId: string,
  eventType: "PAYMENT_CONFIRMED" | "PAYMENT_REVERSED",
  sourceReference: string,
): SQL {
  const requiredStatus = eventType === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "REVERSED";
  const eventColumn =
    eventType === "PAYMENT_CONFIRMED"
      ? sql`payment.confirmed_at`
      : sql`payment.reversed_at`;
  return sql`
    select 'PAYMENT'::text as "sourceType", payment.id as "sourceId",
      payment.payment_reference as "sourceReference",
      (event.safe_metadata ->> 'paymentVersion')::integer as "sourceVersion",
      payment.customer_id as "customerId", null::uuid as "bookingOccupancyId",
      null::uuid as "businessAuditEventId",
      null::uuid as "bookingAuditEventId",
      null::uuid as "jobAuditEventId",
      event.id as "financeAuditEventId", event.created_at as "occurredAt",
      customer.preferred_locale as "localeHint",
      jsonb_build_object(
        'sourceSnapshotChecksumSha256', encode(sha256(convert_to(
          jsonb_build_object(
            'paymentReference', payment.payment_reference,
            'status', payment.status,
            'method', payment.method,
            'currency', payment.currency,
            'amountMinorUnits', payment.amount_minor_units,
            'receivedAt', payment.received_at,
            'confirmedAt', payment.confirmed_at,
            'reversedAt', payment.reversed_at,
            'version', event.safe_metadata -> 'paymentVersion'
          )::text, 'UTF8')), 'hex'),
        'sourceAuditEventType', event.event_type,
        'amountMinorUnits', payment.amount_minor_units,
        'method', payment.method,
        'receivedAt', payment.received_at,
        'confirmedAt', payment.confirmed_at,
        'reversedAt', payment.reversed_at
      ) as payload
    from ${payments} payment
    join ${customers} customer on customer.id = payment.customer_id
    join ${financeAuditEvents} event
      on event.payment_id = payment.id and event.event_type = ${eventType}
    where payment.payment_reference = ${sourceReference}
      and payment.status = ${requiredStatus}
      and ${eventColumn} is not null
      and pg_input_is_valid(event.safe_metadata ->> 'paymentVersion', 'integer')
      and ${staffSourcePermissionSql(actorProfileId, eventType)}
    order by event.created_at desc, event.id desc
    limit 1
  `;
}

export async function resolveCommunicationSource(
  database: Database,
  actorProfileId: string,
  input: Readonly<{
    eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">;
    sourceReference: string;
    documentType: CommunicationDocumentType;
  }>,
): Promise<ResolvedCommunicationSource | null> {
  let query: SQL;
  switch (input.eventType) {
    case "QUOTE_ISSUED":
      query = quoteSourceSql(actorProfileId, input.sourceReference);
      break;
    case "BOOKING_CONFIRMED":
    case "BOOKING_RESCHEDULED":
    case "BOOKING_CANCELLED":
      query = bookingSourceSql(
        actorProfileId,
        input.eventType,
        input.sourceReference,
      );
      break;
    case "JOB_COMPLETED":
      query = jobSourceSql(
        actorProfileId,
        input.sourceReference,
        input.documentType,
      );
      break;
    case "INVOICE_ISSUED":
      query = invoiceSourceSql(actorProfileId, input.sourceReference);
      break;
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_REVERSED":
      query = paymentSourceSql(
        actorProfileId,
        input.eventType,
        input.sourceReference,
      );
      break;
  }
  const result = await database.execute<RawCommunicationSourceRow>(query);
  const row = result.rows[0];
  if (!row) return null;
  return projectCommunicationSource(input.eventType, input.documentType, row);
}

export const communicationSourceSqlForTesting = {
  quoteSourceSql,
  bookingSourceSql,
  jobSourceSql,
  invoiceSourceSql,
  paymentSourceSql,
};
