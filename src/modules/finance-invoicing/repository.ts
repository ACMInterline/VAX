import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  businessLegalProfiles,
  customerBillingProfiles,
  financeAuditEvents,
  invoiceItems,
  invoiceNumberingPolicies,
  invoicePolicies,
  invoices,
  paymentAllocations,
  paymentReversals,
  payments,
} from "@/db/schema/finance-invoicing";
import { bookingItems, bookings, quoteAcceptances } from "@/db/schema/booking-engine";
import { customerIdentityLinks, customers } from "@/db/schema/customer-crm";
import { jobItems, jobs } from "@/db/schema/job-execution";
import { quoteItems, quotes } from "@/db/schema/request-quote";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import type { JsonObject } from "@/modules/request-quote/types";
import type { FinanceRepository } from "./service";
import { displayInvoiceStatus } from "./settlement";
import type {
  AllocatePaymentInput,
  CancelInvoiceInput,
  ConfirmPaymentInput,
  CreateInvoiceDraftInput,
  CustomerInvoiceDetail,
  FinanceAuditItem,
  FinanceDashboard,
  FinanceRepositoryResult,
  FinanceReviewReasonCode,
  InvoiceDisplayStatus,
  InvoiceLineSnapshot,
  InvoiceStoredStatus,
  InvoiceSummary,
  IssueInvoiceInput,
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
  RecordPaymentInput,
  ReversePaymentInput,
  StaffInvoiceDetail,
  StaffInvoiceListInput,
  StaffInvoicePage,
} from "./types";

type MutationRow = {
  result: string;
  invoiceReference: string | null;
  invoiceNumber: string | null;
  paymentReference: string | null;
  reasonCodes: unknown;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function reviewReasons(value: unknown): readonly FinanceReviewReasonCode[] {
  return strings(value) as readonly FinanceReviewReasonCode[];
}

function mutationResult(row: MutationRow | undefined): FinanceRepositoryResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (
    row.result === "CONFLICT" ||
    row.result === "INVALID_TRANSITION" ||
    row.result === "IDEMPOTENCY_CONFLICT"
  ) {
    return { status: row.result };
  }
  if (row.result === "FINANCE_REVIEW_REQUIRED") {
    return {
      status: "FINANCE_REVIEW_REQUIRED",
      invoiceReference: row.invoiceReference ?? undefined,
      reasonCodes: reviewReasons(row.reasonCodes),
    };
  }
  if (
    row.result === "CREATED" ||
    row.result === "EXISTING" ||
    row.result === "ISSUED" ||
    row.result === "UPDATED" ||
    row.result === "NO_CHANGE"
  ) {
    return {
      status: row.result,
      invoiceReference: row.invoiceReference ?? undefined,
      invoiceNumber: row.invoiceNumber ?? undefined,
      paymentReference: row.paymentReference ?? undefined,
    };
  }
  return { status: "CONFLICT" };
}

function staffPermissionSql(
  actorProfileId: string,
  ...permissions: readonly (
    | "FINANCE_READ"
    | "FINANCE_MANAGE"
    | "INVOICE_ISSUE"
    | "PAYMENT_RECORD"
  )[]
): SQL {
  return sql.join(
    permissions.map((permission) =>
      activeActorPermissionSql(actorProfileId, permission),
    ),
    sql` and `,
  );
}

function customerInvoiceAccessSql(
  actorProfileId: string,
  customerId: SQL,
): SQL {
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

async function existingInvoiceForBooking(
  database: Database,
  actorProfileId: string,
  bookingReference: string,
): Promise<FinanceRepositoryResult | null> {
  const result = await database.execute<MutationRow>(sql`
    select 'EXISTING'::text as result,
      invoice.invoice_reference as "invoiceReference",
      invoice.invoice_number as "invoiceNumber",
      null::text as "paymentReference",
      invoice.finance_review_reason_codes as "reasonCodes"
    from ${bookings} booking
    join ${invoices} invoice on invoice.booking_id = booking.id
    where booking.booking_reference = ${bookingReference}
      and invoice.type = 'STANDARD'
      and invoice.status <> 'CANCELLED'
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE")}
    limit 1
  `);
  return result.rows[0] ? mutationResult(result.rows[0]) : null;
}

async function classifyDraftConfigurationFailure(
  database: Database,
  actorProfileId: string,
  input: CreateInvoiceDraftInput,
): Promise<FinanceRepositoryResult | null> {
  const result = await database.execute<MutationRow>(sql`
    with authorized_booking as materialized (
      select booking.id
      from ${bookings} booking
      where booking.booking_reference = ${input.bookingReference}
        and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE")}
      limit 1
    ),
    approved_policy as materialized (
      select policy.id, policy.numbering_policy_id, policy.environment_scope
      from ${invoicePolicies} policy
      where policy.environment_scope = ${input.environmentScope}
        and policy.status = 'APPROVED'
      limit 1
    )
    select 'FINANCE_REVIEW_REQUIRED'::text as result,
      null::text as "invoiceReference", null::text as "invoiceNumber",
      null::text as "paymentReference",
      jsonb_build_array('INVOICE_POLICY_MISSING') as "reasonCodes"
    from authorized_booking
    where not exists (select 1 from approved_policy)
    union all
    select 'FINANCE_REVIEW_REQUIRED'::text as result,
      null::text as "invoiceReference", null::text as "invoiceNumber",
      null::text as "paymentReference",
      jsonb_build_array('NUMBERING_POLICY_MISSING') as "reasonCodes"
    from authorized_booking
    where exists (select 1 from approved_policy)
      and not exists (
        select 1
        from approved_policy policy
        join ${invoiceNumberingPolicies} numbering
          on numbering.id = policy.numbering_policy_id
         and numbering.environment_scope = policy.environment_scope
         and numbering.document_type = 'STANDARD'
         and numbering.status = 'APPROVED'
      )
    limit 1
  `);
  return result.rows[0] ? mutationResult(result.rows[0]) : null;
}

/**
 * Copies only immutable accepted Quote/Booking evidence. Current price books,
 * request normalization, and CRM commercial fields are intentionally absent.
 */
export async function createInvoiceDraftRecord(
  database: Database,
  actorProfileId: string,
  input: CreateInvoiceDraftInput,
): Promise<FinanceRepositoryResult> {
  try {
    const result = await database.execute<MutationRow>(sql`
      with target as materialized (
        select booking.id as booking_id,
          booking.booking_reference,
          booking.request_id,
          booking.quote_id,
          booking.quote_acceptance_id,
          booking.customer_id,
          booking.property_id,
          booking.status as booking_status,
          booking.price_snapshot,
          acceptance.commercial_snapshot as acceptance_commercial_snapshot,
          acceptance.terms_snapshot as acceptance_terms_snapshot,
          acceptance.pricing_snapshot as acceptance_pricing_snapshot,
          acceptance.provenance_snapshot as acceptance_provenance_snapshot,
          quote.quote_reference,
          quote.status as quote_status,
          quote.currency,
          quote.price_basis,
          quote.net_amount_minor_units,
          quote.vat_rate_basis_points,
          quote.vat_amount_minor_units,
          quote.gross_total_minor_units,
          quote.commercial_snapshot,
          quote.terms_snapshot,
          quote.acceptance_source_snapshot,
          customer.customer_type,
          customer.display_name,
          policy.id as invoice_policy_id,
          policy.code as invoice_policy_code,
          policy.version as invoice_policy_version,
          policy.environment_scope,
          policy.draft_eligibility,
          policy.issue_eligibility,
          policy.payment_terms,
          policy.default_due_days,
          policy.numbering_policy_id,
          numbering.code as numbering_policy_code,
          numbering.version as numbering_policy_version,
          billing.id as billing_profile_id,
          billing.version as billing_profile_version,
          billing.billing_name,
          billing.billing_email,
          billing.billing_address_line_1,
          billing.billing_address_line_2,
          billing.billing_city,
          billing.billing_postal_code,
          billing.billing_country_code,
          billing.company_registration_number,
          billing.vat_number as customer_vat_number,
          billing.vat_number_status,
          seller.id as seller_profile_id,
          seller.version as seller_profile_version,
          seller.legal_name as seller_legal_name,
          seller.registration_number as seller_registration_number,
          seller.vat_number as seller_vat_number,
          seller.vat_registration_status,
          seller.registered_address_line_1,
          seller.registered_address_line_2,
          seller.registered_city,
          seller.registered_postal_code,
          seller.registered_country_code,
          seller.contact_email as seller_contact_email,
          seller.contact_phone as seller_contact_phone,
          seller.customer_visible_payment_instructions,
          job.id as job_id,
          job.job_reference,
          job.status as job_status
        from ${bookings} booking
        join ${quoteAcceptances} acceptance
          on acceptance.id = booking.quote_acceptance_id
         and acceptance.quote_id = booking.quote_id
         and acceptance.request_id = booking.request_id
         and acceptance.customer_id = booking.customer_id
         and acceptance.property_id = booking.property_id
        join ${quotes} quote
          on quote.id = booking.quote_id
         and quote.request_id = booking.request_id
         and quote.customer_id = booking.customer_id
         and quote.property_id = booking.property_id
        join ${customers} customer on customer.id = booking.customer_id
        join ${invoicePolicies} policy
          on policy.environment_scope = ${input.environmentScope}
         and policy.status = 'APPROVED'
        join ${invoiceNumberingPolicies} numbering
          on numbering.id = policy.numbering_policy_id
         and numbering.environment_scope = policy.environment_scope
         and numbering.document_type = 'STANDARD'
         and numbering.status = 'APPROVED'
        left join ${customerBillingProfiles} billing
          on billing.customer_id = booking.customer_id
         and billing.status = 'APPROVED'
        left join ${businessLegalProfiles} seller
          on seller.id = policy.seller_legal_profile_id
         and seller.environment_scope = policy.environment_scope
         and seller.status = 'APPROVED'
        left join ${jobs} job on job.booking_id = booking.id
        where booking.booking_reference = ${input.bookingReference}
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE")}
        for share of booking, acceptance, quote, customer, policy, numbering
      ),
      integrity as materialized (
        select target.*,
          coalesce((
            select count(*) from ${bookingItems} booking_item
            where booking_item.booking_id = target.booking_id
          ), 0)::integer as booking_item_count,
          coalesce((
            select count(*) from ${quoteItems} quote_item
            where quote_item.quote_id = target.quote_id
          ), 0)::integer as quote_item_count,
          coalesce((
            select sum(booking_item.net_amount_minor_units)
            from ${bookingItems} booking_item
            where booking_item.booking_id = target.booking_id
          ), 0)::integer as line_net,
          coalesce((
            select sum(booking_item.vat_amount_minor_units)
            from ${bookingItems} booking_item
            where booking_item.booking_id = target.booking_id
          ), 0)::integer as line_vat,
          coalesce((
            select sum(booking_item.gross_total_minor_units)
            from ${bookingItems} booking_item
            where booking_item.booking_id = target.booking_id
          ), 0)::integer as line_gross,
          not exists (
            select 1
            from ${bookingItems} booking_item
            left join ${quoteItems} quote_item
              on quote_item.id = booking_item.quote_item_id
             and quote_item.quote_id = target.quote_id
            where booking_item.booking_id = target.booking_id
              and (
                quote_item.id is null
                or booking_item.request_item_id is distinct from quote_item.request_item_id
                or booking_item.service_id is distinct from quote_item.service_id
                or booking_item.cleaning_item_type_id is distinct from quote_item.cleaning_item_type_id
                or booking_item.measurement_mode_id is distinct from quote_item.measurement_mode_id
                or booking_item.description_bg <> quote_item.description_bg
                or booking_item.description_en <> quote_item.description_en
                or booking_item.quantity <> quote_item.quantity
                or booking_item.measurement_snapshot <> quote_item.measurement_snapshot
                or booking_item.base_amount_minor_units <> quote_item.base_amount_minor_units
                or booking_item.modifier_amount_minor_units <> quote_item.modifier_amount_minor_units
                or booking_item.addon_amount_minor_units <> quote_item.addon_amount_minor_units
                or booking_item.net_amount_minor_units <> quote_item.net_amount_minor_units
                or booking_item.vat_rate_basis_points <> quote_item.vat_rate_basis_points
                or booking_item.vat_amount_minor_units <> quote_item.vat_amount_minor_units
                or booking_item.gross_total_minor_units <> quote_item.gross_total_minor_units
                or booking_item.calculation_snapshot <> quote_item.calculation_snapshot
                or booking_item.sort_order <> quote_item.sort_order
              )
          ) as item_graph_matches,
          coalesce((
            select count(*) from ${jobItems} job_item
            where job_item.job_id = target.job_id
          ), 0)::integer as job_item_count,
          target.job_id is not null and (
            target.job_status in ('REQUIRES_REVIEW', 'CANCELLED')
            or exists (
              select 1
              from ${jobItems} job_item
              left join ${bookingItems} booking_item
                on booking_item.id = job_item.booking_item_id
               and booking_item.booking_id = target.booking_id
              where job_item.job_id = target.job_id
                and (
                  booking_item.id is null
                  or job_item.status in ('DECLINED', 'REFERRED', 'REQUIRES_REVIEW')
                  or (target.job_status = 'COMPLETED'
                    and job_item.status <> 'COMPLETED')
                  or job_item.quantity <> booking_item.quantity
                  or job_item.planned_measurement_snapshot <>
                    booking_item.measurement_snapshot
                )
            )
          ) as job_known_divergence,
          not exists (
            select 1
            from ${jobItems} job_item
            join ${bookingItems} booking_item
              on booking_item.id = job_item.booking_item_id
             and booking_item.booking_id = target.booking_id
            where job_item.job_id = target.job_id
              and (
                job_item.status <> 'COMPLETED'
                or job_item.quantity <> booking_item.quantity
                or job_item.planned_measurement_snapshot <> booking_item.measurement_snapshot
              )
          ) as job_scope_matches
        from target
      ),
      reviewed as materialized (
        select integrity.*,
          array_remove(array[
            case when quote_status <> 'ISSUED'
              or acceptance_source_snapshot is null
              or booking_status = 'CANCELLED'
              then 'COMMERCIAL_PROVENANCE_INCOMPLETE' end,
            case when booking_item_count = 0
              or booking_item_count <> quote_item_count
              or item_graph_matches = false
              or line_net <> net_amount_minor_units
              or line_vat <> vat_amount_minor_units
              or line_gross <> gross_total_minor_units
              or price_snapshot #> '{grossTotalMinorUnits}'
                is distinct from to_jsonb(gross_total_minor_units)
              or acceptance_commercial_snapshot is distinct from commercial_snapshot
              or acceptance_terms_snapshot is distinct from terms_snapshot
              then 'COMMERCIAL_TOTALS_INCONSISTENT' end,
            case when billing_profile_id is null
              then 'CUSTOMER_BILLING_PROFILE_MISSING' end,
            case when seller_profile_id is null
              then 'SELLER_LEGAL_PROFILE_MISSING' end,
            case when vat_registration_status is null
              or vat_registration_status = 'UNVERIFIED'
              then 'VAT_STATE_UNRESOLVED' end,
            case when customer_type = 'BUSINESS'
              and (company_registration_number is null
                or vat_number_status = 'UNVERIFIED')
              then 'CUSTOMER_BILLING_PROFILE_UNAPPROVED' end,
            case when (vat_registration_status = 'VAT_NOT_REGISTERED'
                and (vat_amount_minor_units <> 0
                  or net_amount_minor_units <> gross_total_minor_units))
              or (vat_registration_status = 'VAT_REGISTERED'
                and vat_rate_basis_points = 0)
              then 'VAT_STATE_UNRESOLVED' end,
            case when issue_eligibility = 'JOB_COMPLETED'
              and job_status is distinct from 'COMPLETED'
              then 'JOB_COMPLETION_REQUIRED' end,
            case when job_id is not null and (
                job_item_count <> booking_item_count
                or job_known_divergence
                or (
                  issue_eligibility = 'JOB_COMPLETED'
                  and job_status = 'COMPLETED'
                  and job_item_count = booking_item_count
                  and job_scope_matches = false
                )
              )
              then 'JOB_SCOPE_DIFFERENCE' end,
            case when default_due_days is null
              then 'INVOICE_POLICY_MISSING' end,
            case when ${input.manualAdjustmentRequested}
              then 'MANUAL_ADJUSTMENT_REQUESTED' end
          ]::text[], null) as review_reasons
        from integrity
      ),
      inserted_invoice as (
        insert into ${invoices} (
          invoice_reference, invoice_policy_id, invoice_policy_code,
          invoice_policy_version, environment_scope,
          request_id, quote_id, quote_acceptance_id,
          booking_id, job_id, customer_id, property_id,
          customer_billing_profile_id, customer_billing_profile_version,
          seller_legal_profile_id, seller_legal_profile_version,
          type, status, finance_review_status, finance_review_reason_codes,
          currency, price_basis, vat_mode, vat_basis,
          net_amount_minor_units, vat_rate_basis_points,
          vat_amount_minor_units, gross_total_minor_units,
          customer_snapshot, seller_snapshot, commercial_snapshot,
          terms_snapshot, provenance_snapshot, eligibility_snapshot,
          internal_notes, customer_visible_notes,
          creation_idempotency_key, creation_fingerprint,
          created_by_profile_id
        )
        select ${input.invoiceReference}, invoice_policy_id,
          invoice_policy_code, invoice_policy_version, environment_scope,
          request_id, quote_id,
          quote_acceptance_id, booking_id, job_id, customer_id, property_id,
          billing_profile_id, billing_profile_version,
          seller_profile_id, seller_profile_version,
          'STANDARD',
          case when cardinality(review_reasons) = 0
            then 'READY_TO_ISSUE' else 'DRAFT' end,
          case when cardinality(review_reasons) = 0 then 'CLEAR' else 'REQUIRED' end,
          to_jsonb(review_reasons), currency, price_basis,
          case when vat_amount_minor_units = 0
              and net_amount_minor_units = gross_total_minor_units
            then 'VAT_NOT_REGISTERED' else 'VAT_REGISTERED' end,
          case when vat_amount_minor_units = 0
              and net_amount_minor_units = gross_total_minor_units
            then 'NOT_REGISTERED' else price_basis end,
          net_amount_minor_units, vat_rate_basis_points,
          vat_amount_minor_units, gross_total_minor_units,
          jsonb_build_object(
            'customerType', customer_type,
            'billingName', billing_name,
            'billingEmail', billing_email,
            'addressLine1', billing_address_line_1,
            'addressLine2', billing_address_line_2,
            'city', billing_city,
            'postalCode', billing_postal_code,
            'countryCode', billing_country_code,
            'companyRegistrationNumber', company_registration_number,
            'vatNumber', customer_vat_number,
            'vatNumberStatus', vat_number_status
          ),
          case when seller_profile_id is null then '{}'::jsonb else
            jsonb_build_object(
              'legalName', seller_legal_name,
              'registrationNumber', seller_registration_number,
              'vatNumber', seller_vat_number,
              'vatRegistrationStatus', vat_registration_status,
              'addressLine1', registered_address_line_1,
              'addressLine2', registered_address_line_2,
              'city', registered_city,
              'postalCode', registered_postal_code,
              'countryCode', registered_country_code,
              'contactEmail', seller_contact_email,
              'contactPhone', seller_contact_phone,
              'paymentInstructions', customer_visible_payment_instructions
            ) end,
          commercial_snapshot,
          jsonb_build_object(
            'quoteTerms', terms_snapshot,
            'paymentTerms', payment_terms,
            'defaultDueDays', default_due_days
          ),
          jsonb_build_object(
            'quoteReference', quote_reference,
            'bookingReference', booking_reference,
            'quoteAcceptanceId', quote_acceptance_id,
            'acceptanceProvenance', acceptance_provenance_snapshot,
            'acceptancePricing', acceptance_pricing_snapshot
          ),
          jsonb_build_object(
            'draftEligibility', draft_eligibility,
            'issueEligibility', issue_eligibility,
            'jobReference', job_reference,
            'jobStatus', job_status
          ),
          ${input.internalNote}, ${input.customerVisibleNote},
          gen_random_uuid(),
          encode(sha256(convert_to(jsonb_build_object(
            'bookingId', booking_id,
            'invoicePolicyId', invoice_policy_id,
            'customerVisibleNote', ${input.customerVisibleNote}::text,
            'internalNote', ${input.internalNote}::text
          )::text, 'UTF8')), 'hex'),
          ${actorProfileId}::uuid
        from reviewed
        where booking_item_count > 0
          and booking_item_count = quote_item_count
          and item_graph_matches = true
          and line_net = net_amount_minor_units
          and line_vat = vat_amount_minor_units
          and line_gross = gross_total_minor_units
          and (job_id is null or job_item_count = booking_item_count)
          and (issue_eligibility <> 'JOB_COMPLETED' or job_id is not null)
          and (draft_eligibility <> 'JOB_COMPLETED'
            or job_status = 'COMPLETED')
        returning id, invoice_reference, status, finance_review_reason_codes,
          version
      ),
      inserted_items as (
        insert into ${invoiceItems} (
          invoice_id, booking_id, quote_id, quote_item_id, booking_item_id,
          job_id, job_item_id, service_id, description_bg, description_en,
          quantity, measurement_snapshot, net_amount_minor_units,
          vat_rate_basis_points, vat_amount_minor_units,
          gross_total_minor_units, provenance_snapshot, sort_order
        )
        select inserted_invoice.id, reviewed.booking_id, reviewed.quote_id,
          booking_item.quote_item_id, booking_item.id,
          reviewed.job_id, job_item.id, booking_item.service_id,
          booking_item.description_bg, booking_item.description_en,
          booking_item.quantity, booking_item.measurement_snapshot,
          booking_item.net_amount_minor_units,
          booking_item.vat_rate_basis_points,
          booking_item.vat_amount_minor_units,
          booking_item.gross_total_minor_units,
          jsonb_build_object(
            'bookingItemId', booking_item.id,
            'quoteItemId', booking_item.quote_item_id,
            'jobItemId', job_item.id,
            'calculationSnapshot', booking_item.calculation_snapshot
          ), booking_item.sort_order
        from inserted_invoice
        join reviewed on true
        join ${bookingItems} booking_item
          on booking_item.booking_id = reviewed.booking_id
        left join ${jobItems} job_item
          on job_item.job_id = reviewed.job_id
         and job_item.booking_item_id = booking_item.id
        returning id
      ),
      audit as (
        insert into ${financeAuditEvents} (
          invoice_id, event_type, actor_profile_id, source,
          previous_status, next_status, safe_metadata
        )
        select inserted_invoice.id,
          case when inserted_invoice.status = 'READY_TO_ISSUE'
            then 'INVOICE_READY' else 'FINANCE_REVIEW_REQUIRED' end,
          ${actorProfileId}::uuid, 'STAFF', null, inserted_invoice.status,
          jsonb_build_object(
            'invoiceReference', inserted_invoice.invoice_reference,
            'invoiceVersion', inserted_invoice.version,
            'reviewReasonCodes', inserted_invoice.finance_review_reason_codes
          )
        from inserted_invoice
        returning invoice_id
      )
      select case when inserted_invoice.status = 'READY_TO_ISSUE'
          then 'CREATED' else 'FINANCE_REVIEW_REQUIRED' end as result,
        inserted_invoice.invoice_reference as "invoiceReference",
        null::text as "invoiceNumber", null::text as "paymentReference",
        inserted_invoice.finance_review_reason_codes as "reasonCodes"
      from inserted_invoice
      where exists (select 1 from inserted_items)
        and exists (select 1 from audit)
      union all
      select 'FINANCE_REVIEW_REQUIRED'::text as result,
        null::text as "invoiceReference", null::text as "invoiceNumber",
        null::text as "paymentReference",
        to_jsonb(review_reasons) as "reasonCodes"
      from reviewed
      where booking_item_count > 0
        and booking_item_count = quote_item_count
        and item_graph_matches = true
        and line_net = net_amount_minor_units
        and line_vat = vat_amount_minor_units
        and line_gross = gross_total_minor_units
        and (job_id is null or job_item_count = booking_item_count)
        and (
          (draft_eligibility = 'JOB_COMPLETED'
            and job_status is distinct from 'COMPLETED')
          or (issue_eligibility = 'JOB_COMPLETED' and job_id is null)
        )
      union all
      select 'FINANCE_REVIEW_REQUIRED'::text as result,
        null::text as "invoiceReference", null::text as "invoiceNumber",
        null::text as "paymentReference",
        to_jsonb(review_reasons) as "reasonCodes"
      from reviewed
      where booking_item_count = 0
        or booking_item_count <> quote_item_count
        or item_graph_matches = false
        or line_net <> net_amount_minor_units
        or line_vat <> vat_amount_minor_units
        or line_gross <> gross_total_minor_units
        or (job_id is not null and job_item_count <> booking_item_count)
    `);
    if (!result.rows[0]) {
      return (
        (await classifyDraftConfigurationFailure(
          database,
          actorProfileId,
          input,
        )) ?? { status: "NOT_FOUND_OR_FORBIDDEN" }
      );
    }
    return mutationResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await existingInvoiceForBooking(
        database,
        actorProfileId,
        input.bookingReference,
      );
      return existing ?? { status: "REFERENCE_CONFLICT" };
    }
    throw error;
  }
}

async function loadInvoiceMutationState(
  database: Database,
  actorProfileId: string,
  invoiceReference: string,
  expectedVersion?: number,
): Promise<MutationRow | undefined> {
  const result = await database.execute<MutationRow>(sql`
    select case
        when invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          then 'EXISTING'
        when invoice.status = 'CANCELLED' then 'INVALID_TRANSITION'
        when ${expectedVersion ?? null}::integer is not null
          and invoice.version <> ${expectedVersion ?? null}::integer
          then 'CONFLICT'
        when invoice.status in ('DRAFT', 'READY_TO_ISSUE')
          then 'FINANCE_REVIEW_REQUIRED'
        else 'INVALID_TRANSITION'
      end as result,
      invoice.invoice_reference as "invoiceReference",
      invoice.invoice_number as "invoiceNumber",
      null::text as "paymentReference",
      case
        when jsonb_array_length(invoice.finance_review_reason_codes) > 0
          then invoice.finance_review_reason_codes
        else jsonb_build_array('COMMERCIAL_PROVENANCE_INCOMPLETE')
      end as "reasonCodes"
    from ${invoices} invoice
    where invoice.invoice_reference = ${invoiceReference}
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "INVOICE_ISSUE")}
    limit 1
  `);
  return result.rows[0];
}

export async function issueInvoiceRecord(
  database: Database,
  actorProfileId: string,
  input: IssueInvoiceInput,
): Promise<FinanceRepositoryResult> {
  const previous = await loadInvoiceMutationState(
    database,
    actorProfileId,
    input.invoiceReference,
    input.expectedVersion,
  );
  if (previous?.result === "EXISTING") return mutationResult(previous);

  try {
    const [, , , result] = await database.batch([
      database.execute(sql`set transaction isolation level read committed`),
      database.execute(sql`
        select numbering.id
        from ${invoices} invoice
        join ${invoicePolicies} policy on policy.id = invoice.invoice_policy_id
        join ${invoiceNumberingPolicies} numbering
          on numbering.id = policy.numbering_policy_id
        where invoice.invoice_reference = ${input.invoiceReference}
          and numbering.environment_scope = ${input.environmentScope}
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "INVOICE_ISSUE")}
        for update of numbering
      `),
      database.execute(sql`
        select job.id
        from ${invoices} invoice
        join ${jobs} job on job.id = invoice.job_id
        where invoice.invoice_reference = ${input.invoiceReference}
          and invoice.environment_scope = ${input.environmentScope}
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "INVOICE_ISSUE")}
        for share of job
      `),
      database.execute<MutationRow>(sql`
        with job_lock as materialized (
          select job.id, job.status, job.job_reference
          from ${invoices} invoice
          join ${jobs} job on job.id = invoice.job_id
          where invoice.invoice_reference = ${input.invoiceReference}
          for share of job
        ),
        target as materialized (
          select invoice.id, invoice.invoice_reference,
            invoice.status, invoice.version, invoice.finance_review_status,
            policy.id as policy_id, policy.code as policy_code,
            policy.version as policy_version, policy.environment_scope,
            policy.default_due_days, policy.issue_eligibility,
            numbering.id as numbering_id, numbering.code as numbering_code,
            numbering.version as numbering_version, numbering.prefix,
            numbering.padding_width, numbering.provisional,
            seller.id as seller_id, seller.version as seller_version
          from ${invoices} invoice
          join ${invoicePolicies} policy
            on policy.id = invoice.invoice_policy_id
           and policy.code = invoice.invoice_policy_code
           and policy.version = invoice.invoice_policy_version
           and policy.environment_scope = invoice.environment_scope
          join ${invoiceNumberingPolicies} numbering
            on numbering.id = policy.numbering_policy_id
           and numbering.environment_scope = invoice.environment_scope
          join ${businessLegalProfiles} seller
            on seller.id = invoice.seller_legal_profile_id
           and seller.version = invoice.seller_legal_profile_version
           and seller.environment_scope = invoice.environment_scope
          join ${customerBillingProfiles} billing
            on billing.id = invoice.customer_billing_profile_id
           and billing.customer_id = invoice.customer_id
           and billing.version = invoice.customer_billing_profile_version
          join ${bookings} booking
            on booking.id = invoice.booking_id
           and booking.request_id = invoice.request_id
           and booking.quote_id = invoice.quote_id
           and booking.quote_acceptance_id = invoice.quote_acceptance_id
           and booking.customer_id = invoice.customer_id
           and booking.property_id = invoice.property_id
          join ${quoteAcceptances} acceptance
            on acceptance.id = invoice.quote_acceptance_id
           and acceptance.quote_id = invoice.quote_id
           and acceptance.request_id = invoice.request_id
           and acceptance.customer_id = invoice.customer_id
           and acceptance.property_id = invoice.property_id
          join ${quotes} quote
            on quote.id = invoice.quote_id
           and quote.request_id = invoice.request_id
           and quote.customer_id = invoice.customer_id
           and quote.property_id = invoice.property_id
          join ${customers} customer on customer.id = invoice.customer_id
          left join job_lock on job_lock.id = invoice.job_id
          where invoice.invoice_reference = ${input.invoiceReference}
            and invoice.version = ${input.expectedVersion}
            and (
              (invoice.status = 'READY_TO_ISSUE'
                and invoice.finance_review_status = 'CLEAR'
                and jsonb_array_length(invoice.finance_review_reason_codes) = 0)
              or
              (invoice.status = 'DRAFT'
                and invoice.finance_review_status = 'REQUIRED'
                and invoice.finance_review_reason_codes =
                  '["JOB_COMPLETION_REQUIRED"]'::jsonb
                and policy.issue_eligibility = 'JOB_COMPLETED')
            )
            and policy.status = 'APPROVED'
            and policy.environment_scope = ${input.environmentScope}
            and invoice.environment_scope = ${input.environmentScope}
            and policy.default_due_days is not null
            and numbering.status = 'APPROVED'
            and numbering.environment_scope = policy.environment_scope
            and numbering.document_type = 'STANDARD'
            and seller.status = 'APPROVED'
            and seller.environment_scope = policy.environment_scope
            and billing.status = 'APPROVED'
            and (
              (seller.vat_registration_status = 'VAT_NOT_REGISTERED'
                and invoice.vat_mode = 'VAT_NOT_REGISTERED'
                and invoice.vat_basis = 'NOT_REGISTERED'
                and invoice.vat_rate_basis_points = 0
                and invoice.vat_amount_minor_units = 0)
              or (seller.vat_registration_status = 'VAT_REGISTERED'
                and invoice.vat_mode = 'VAT_REGISTERED'
                and invoice.vat_basis = invoice.price_basis)
            )
            and booking.status <> 'CANCELLED'
            and quote.status = 'ISSUED'
            and quote.acceptance_source_snapshot is not null
            and invoice.currency = quote.currency
            and invoice.price_basis = quote.price_basis
            and invoice.net_amount_minor_units = quote.net_amount_minor_units
            and invoice.vat_rate_basis_points = quote.vat_rate_basis_points
            and invoice.vat_amount_minor_units = quote.vat_amount_minor_units
            and invoice.gross_total_minor_units = quote.gross_total_minor_units
            and invoice.paid_amount_minor_units = 0
            and booking.price_snapshot #> '{grossTotalMinorUnits}' =
              to_jsonb(invoice.gross_total_minor_units)
            and invoice.commercial_snapshot = quote.commercial_snapshot
            and acceptance.commercial_snapshot = quote.commercial_snapshot
            and acceptance.terms_snapshot = quote.terms_snapshot
            and invoice.terms_snapshot -> 'quoteTerms' = acceptance.terms_snapshot
            and invoice.terms_snapshot ->> 'paymentTerms' = policy.payment_terms
            and (invoice.terms_snapshot ->> 'defaultDueDays')::integer =
              policy.default_due_days
            and invoice.customer_snapshot = jsonb_build_object(
              'customerType', customer.customer_type,
              'billingName', billing.billing_name,
              'billingEmail', billing.billing_email,
              'addressLine1', billing.billing_address_line_1,
              'addressLine2', billing.billing_address_line_2,
              'city', billing.billing_city,
              'postalCode', billing.billing_postal_code,
              'countryCode', billing.billing_country_code,
              'companyRegistrationNumber', billing.company_registration_number,
              'vatNumber', billing.vat_number,
              'vatNumberStatus', billing.vat_number_status
            )
            and (customer.customer_type <> 'BUSINESS'
              or (billing.company_registration_number is not null
                and billing.vat_number_status <> 'UNVERIFIED'))
            and invoice.seller_snapshot = jsonb_build_object(
              'legalName', seller.legal_name,
              'registrationNumber', seller.registration_number,
              'vatNumber', seller.vat_number,
              'vatRegistrationStatus', seller.vat_registration_status,
              'addressLine1', seller.registered_address_line_1,
              'addressLine2', seller.registered_address_line_2,
              'city', seller.registered_city,
              'postalCode', seller.registered_postal_code,
              'countryCode', seller.registered_country_code,
              'contactEmail', seller.contact_email,
              'contactPhone', seller.contact_phone,
              'paymentInstructions', seller.customer_visible_payment_instructions
            )
            and invoice.provenance_snapshot = jsonb_build_object(
              'quoteReference', quote.quote_reference,
              'bookingReference', booking.booking_reference,
              'quoteAcceptanceId', acceptance.id,
              'acceptanceProvenance', acceptance.provenance_snapshot,
              'acceptancePricing', acceptance.pricing_snapshot
            )
            and invoice.eligibility_snapshot - 'jobStatus' = jsonb_build_object(
              'draftEligibility', policy.draft_eligibility,
              'issueEligibility', policy.issue_eligibility,
              'jobReference', job_lock.job_reference
            )
            and (
              job_lock.id is null
              or (
                job_lock.status not in ('REQUIRES_REVIEW', 'CANCELLED')
                and (select count(*) from ${jobItems} item
                  where item.job_id = job_lock.id) =
                  (select count(*) from ${bookingItems} item
                    where item.booking_id = booking.id)
                and not exists (
                  select 1
                  from ${jobItems} job_item
                  left join ${bookingItems} booking_item
                    on booking_item.id = job_item.booking_item_id
                   and booking_item.booking_id = booking.id
                  where job_item.job_id = job_lock.id
                    and (
                      booking_item.id is null
                      or job_item.status in (
                        'DECLINED', 'REFERRED', 'REQUIRES_REVIEW'
                      )
                      or job_item.quantity <> booking_item.quantity
                      or job_item.planned_measurement_snapshot <>
                        booking_item.measurement_snapshot
                    )
                )
              )
            )
            and (select count(*) from ${invoiceItems} item
              where item.invoice_id = invoice.id) > 0
            and (select count(*) from ${invoiceItems} item
              where item.invoice_id = invoice.id) =
              (select count(*) from ${bookingItems} item
                where item.booking_id = booking.id)
            and (select count(*) from ${bookingItems} item
              where item.booking_id = booking.id) =
              (select count(*) from ${quoteItems} item
                where item.quote_id = quote.id)
            and (select coalesce(sum(item.net_amount_minor_units), 0)
              from ${invoiceItems} item where item.invoice_id = invoice.id) =
              invoice.net_amount_minor_units
            and (select coalesce(sum(item.vat_amount_minor_units), 0)
              from ${invoiceItems} item where item.invoice_id = invoice.id) =
              invoice.vat_amount_minor_units
            and (select coalesce(sum(item.gross_total_minor_units), 0)
              from ${invoiceItems} item where item.invoice_id = invoice.id) =
              invoice.gross_total_minor_units
            and (select coalesce(sum(item.net_amount_minor_units), 0)
              from ${bookingItems} item where item.booking_id = booking.id) =
              invoice.net_amount_minor_units
            and (select coalesce(sum(item.vat_amount_minor_units), 0)
              from ${bookingItems} item where item.booking_id = booking.id) =
              invoice.vat_amount_minor_units
            and (select coalesce(sum(item.gross_total_minor_units), 0)
              from ${bookingItems} item where item.booking_id = booking.id) =
              invoice.gross_total_minor_units
            and (select coalesce(sum(item.net_amount_minor_units), 0)
              from ${quoteItems} item where item.quote_id = quote.id) =
              invoice.net_amount_minor_units
            and (select coalesce(sum(item.vat_amount_minor_units), 0)
              from ${quoteItems} item where item.quote_id = quote.id) =
              invoice.vat_amount_minor_units
            and (select coalesce(sum(item.gross_total_minor_units), 0)
              from ${quoteItems} item where item.quote_id = quote.id) =
              invoice.gross_total_minor_units
            and not exists (
              select 1
              from ${invoiceItems} invoice_item
              left join ${bookingItems} booking_item
                on booking_item.id = invoice_item.booking_item_id
               and booking_item.booking_id = booking.id
               and booking_item.quote_item_id = invoice_item.quote_item_id
              left join ${quoteItems} quote_item
                on quote_item.id = invoice_item.quote_item_id
               and quote_item.quote_id = quote.id
              where invoice_item.invoice_id = invoice.id
                and (
                  booking_item.id is null or quote_item.id is null
                  or invoice_item.service_id is distinct from booking_item.service_id
                  or invoice_item.description_bg <> booking_item.description_bg
                  or invoice_item.description_en <> booking_item.description_en
                  or invoice_item.quantity <> booking_item.quantity
                  or invoice_item.measurement_snapshot <> booking_item.measurement_snapshot
                  or invoice_item.net_amount_minor_units <> booking_item.net_amount_minor_units
                  or invoice_item.vat_rate_basis_points <> booking_item.vat_rate_basis_points
                  or invoice_item.vat_amount_minor_units <> booking_item.vat_amount_minor_units
                  or invoice_item.gross_total_minor_units <> booking_item.gross_total_minor_units
                  or invoice_item.sort_order <> booking_item.sort_order
                  or invoice_item.provenance_snapshot ->> 'bookingItemId'
                    is distinct from invoice_item.booking_item_id::text
                  or invoice_item.provenance_snapshot ->> 'quoteItemId'
                    is distinct from invoice_item.quote_item_id::text
                  or invoice_item.provenance_snapshot ->> 'jobItemId'
                    is distinct from invoice_item.job_item_id::text
                  or invoice_item.provenance_snapshot -> 'calculationSnapshot'
                    is distinct from booking_item.calculation_snapshot
                  or booking_item.request_item_id is distinct from quote_item.request_item_id
                  or booking_item.service_id is distinct from quote_item.service_id
                  or booking_item.cleaning_item_type_id is distinct from quote_item.cleaning_item_type_id
                  or booking_item.measurement_mode_id is distinct from quote_item.measurement_mode_id
                  or booking_item.description_bg <> quote_item.description_bg
                  or booking_item.description_en <> quote_item.description_en
                  or booking_item.quantity <> quote_item.quantity
                  or booking_item.measurement_snapshot <> quote_item.measurement_snapshot
                  or booking_item.base_amount_minor_units <> quote_item.base_amount_minor_units
                  or booking_item.modifier_amount_minor_units <> quote_item.modifier_amount_minor_units
                  or booking_item.addon_amount_minor_units <> quote_item.addon_amount_minor_units
                  or booking_item.net_amount_minor_units <> quote_item.net_amount_minor_units
                  or booking_item.vat_rate_basis_points <> quote_item.vat_rate_basis_points
                  or booking_item.vat_amount_minor_units <> quote_item.vat_amount_minor_units
                  or booking_item.gross_total_minor_units <> quote_item.gross_total_minor_units
                  or booking_item.calculation_snapshot <> quote_item.calculation_snapshot
                  or booking_item.sort_order <> quote_item.sort_order
                )
            )
            and (
              policy.issue_eligibility <> 'JOB_COMPLETED'
              or job_lock.status = 'COMPLETED'
            )
            and (
              job_lock.status is distinct from 'COMPLETED'
              or (
                (select count(*) from ${jobItems} item
                  where item.job_id = job_lock.id) =
                  (select count(*) from ${bookingItems} item
                    where item.booking_id = booking.id)
                and not exists (
                  select 1
                  from ${jobItems} job_item
                  join ${bookingItems} booking_item
                    on booking_item.id = job_item.booking_item_id
                   and booking_item.booking_id = booking.id
                  where job_item.job_id = job_lock.id
                    and (
                      job_item.status <> 'COMPLETED'
                      or job_item.quantity <> booking_item.quantity
                      or job_item.planned_measurement_snapshot <>
                        booking_item.measurement_snapshot
                    )
                )
              )
            )
            and (${input.environmentScope} <> 'PRODUCTION'
              or (policy.provisional = false and numbering.provisional = false))
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "INVOICE_ISSUE")}
          for update of invoice, policy, seller, billing, booking,
            acceptance, quote, customer
        ),
        counter as (
          update ${invoiceNumberingPolicies} numbering
          set next_sequence = numbering.next_sequence + 1,
            updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
          from target
          where numbering.id = target.numbering_id
            and numbering.code = target.numbering_code
            and numbering.version = target.numbering_version
          returning numbering.id, numbering.code, numbering.version,
            numbering.prefix, numbering.padding_width,
            numbering.next_sequence - 1 as allocated_sequence
        ),
        issued as (
          update ${invoices} invoice
          set invoice_number = counter.prefix ||
                lpad(
                  counter.allocated_sequence::text,
                  greatest(
                    counter.padding_width,
                    length(counter.allocated_sequence::text)
                  ),
                  '0'
                ),
            numbering_policy_id = counter.id,
            numbering_policy_code = counter.code,
            numbering_policy_version = counter.version,
            numbering_sequence = counter.allocated_sequence,
            status = 'ISSUED',
            finance_review_status = 'CLEAR',
            finance_review_reason_codes = '[]'::jsonb,
            issue_date = (now() at time zone 'Europe/Sofia')::date,
            due_date = (now() at time zone 'Europe/Sofia')::date +
              target.default_due_days,
            issue_idempotency_key = gen_random_uuid(),
            issued_at = now(), issued_by_profile_id = ${actorProfileId}::uuid,
            updated_at = now(), version = invoice.version + 1
          from target, counter
          where invoice.id = target.id
          returning invoice.id, invoice.invoice_reference,
            invoice.invoice_number, invoice.version,
            target.status as previous_status
        ),
        audit as (
          insert into ${financeAuditEvents} (
            invoice_id, event_type, actor_profile_id, source,
            previous_status, next_status, safe_metadata
          )
          select issued.id, 'INVOICE_ISSUED', ${actorProfileId}::uuid,
            'STAFF', issued.previous_status, 'ISSUED',
            jsonb_build_object(
              'invoiceReference', issued.invoice_reference,
              'invoiceVersion', issued.version,
              'numberingPolicyCode', counter.code,
              'numberingPolicyVersion', counter.version
            )
          from issued, counter
          returning invoice_id
        )
        select 'ISSUED'::text as result,
          issued.invoice_reference as "invoiceReference",
          issued.invoice_number as "invoiceNumber",
          null::text as "paymentReference", '[]'::jsonb as "reasonCodes"
        from issued
        where exists (select 1 from audit)
      `),
    ]);
    if (result.rows[0]) return mutationResult(result.rows[0]);
    return mutationResult(
      await loadInvoiceMutationState(
        database,
        actorProfileId,
        input.invoiceReference,
        input.expectedVersion,
      ),
    );
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export async function cancelDraftInvoiceRecord(
  database: Database,
  actorProfileId: string,
  input: CancelInvoiceInput,
): Promise<FinanceRepositoryResult> {
  const result = await database.execute<MutationRow>(sql`
    with target as materialized (
      select invoice.id, invoice.status
      from ${invoices} invoice
      where invoice.invoice_reference = ${input.invoiceReference}
        and invoice.version = ${input.expectedVersion}
        and invoice.status in ('DRAFT', 'READY_TO_ISSUE')
        and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE")}
      for update of invoice
    ),
    cancelled as (
      update ${invoices} invoice
      set status = 'CANCELLED', cancelled_at = now(),
        cancelled_by_profile_id = ${actorProfileId}::uuid,
        internal_notes = coalesce(invoice.internal_notes || E'\n', '') || ${input.reason},
        updated_at = now(), version = invoice.version + 1
      from target
      where invoice.id = target.id
      returning invoice.id, invoice.invoice_reference, invoice.version,
        target.status as previous_status
    ),
    audit as (
      insert into ${financeAuditEvents} (
        invoice_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select cancelled.id, 'INVOICE_CANCELLED', ${actorProfileId}::uuid,
        'STAFF', cancelled.previous_status, 'CANCELLED',
        jsonb_build_object(
          'invoiceReference', cancelled.invoice_reference,
          'invoiceVersion', cancelled.version
        )
      from cancelled
      returning invoice_id
    )
    select 'UPDATED'::text as result,
      cancelled.invoice_reference as "invoiceReference",
      null::text as "invoiceNumber", null::text as "paymentReference",
      '[]'::jsonb as "reasonCodes"
    from cancelled
    where exists (select 1 from audit)
  `);
  if (result.rows[0]) return mutationResult(result.rows[0]);
  const state = await database.execute<{ status: string }>(sql`
    select invoice.status
    from ${invoices} invoice
    where invoice.invoice_reference = ${input.invoiceReference}
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE")}
    limit 1
  `);
  if (!state.rows[0]) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  return state.rows[0].status === "CANCELLED"
    ? { status: "NO_CHANGE", invoiceReference: input.invoiceReference }
    : state.rows[0].status === "DRAFT" || state.rows[0].status === "READY_TO_ISSUE"
      ? { status: "CONFLICT" }
      : { status: "INVALID_TRANSITION" };
}

function paymentFingerprint(input: RecordPaymentInput): SQL {
  return sql`encode(sha256(convert_to(jsonb_build_object(
    'invoiceReference', ${input.invoiceReference}::text,
    'amountMinorUnits', ${input.amountMinorUnits}::integer,
    'method', ${input.method}::text,
    'receivedAt', ${input.receivedAt.toISOString()}::text,
    'externalReference', ${input.externalReference}::text,
    'internalNote', ${input.internalNote}::text
  )::text, 'UTF8')), 'hex')`;
}

async function existingPaymentByKey(
  database: Database,
  actorProfileId: string,
  input: RecordPaymentInput,
): Promise<FinanceRepositoryResult | null> {
  const fingerprint = paymentFingerprint(input);
  const result = await database.execute<MutationRow>(sql`
    select case when payment.recording_fingerprint = ${fingerprint}
        then 'EXISTING' else 'IDEMPOTENCY_CONFLICT' end as result,
      null::text as "invoiceReference", null::text as "invoiceNumber",
      payment.payment_reference as "paymentReference",
      '[]'::jsonb as "reasonCodes"
    from ${payments} payment
    where payment.recording_idempotency_key = ${input.idempotencyKey}::uuid
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
    limit 1
  `);
  return result.rows[0] ? mutationResult(result.rows[0]) : null;
}

export async function recordPaymentRecord(
  database: Database,
  actorProfileId: string,
  input: RecordPaymentInput,
): Promise<FinanceRepositoryResult> {
  const existing = await existingPaymentByKey(database, actorProfileId, input);
  if (existing) return existing;
  const fingerprint = paymentFingerprint(input);
  try {
    const result = await database.execute<MutationRow>(sql`
      with target as materialized (
        select invoice.id, invoice.customer_id, invoice.currency
        from ${invoices} invoice
        where invoice.invoice_reference = ${input.invoiceReference}
          and invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
        for share of invoice
      ),
      inserted as (
        insert into ${payments} (
          payment_reference, customer_id, status, method, currency,
          amount_minor_units, received_at, external_reference,
          recording_idempotency_key, recording_fingerprint,
          recorded_by_profile_id, internal_notes
        )
        select ${input.paymentReference}, target.customer_id, 'RECORDED',
          ${input.method}, target.currency, ${input.amountMinorUnits},
          ${input.receivedAt}, ${input.externalReference},
          ${input.idempotencyKey}::uuid, ${fingerprint},
          ${actorProfileId}::uuid, ${input.internalNote}
        from target
        returning id, payment_reference, version
      ),
      audit as (
        insert into ${financeAuditEvents} (
          payment_id, event_type, actor_profile_id, source,
          next_status, safe_metadata
        )
        select inserted.id, 'PAYMENT_RECORDED', ${actorProfileId}::uuid,
          'STAFF', 'RECORDED',
          jsonb_build_object(
            'paymentReference', inserted.payment_reference,
            'paymentVersion', inserted.version
          )
        from inserted
        returning payment_id
      )
      select 'CREATED'::text as result,
        null::text as "invoiceReference", null::text as "invoiceNumber",
        inserted.payment_reference as "paymentReference",
        '[]'::jsonb as "reasonCodes"
      from inserted where exists (select 1 from audit)
    `);
    if (result.rows[0]) return mutationResult(result.rows[0]);
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return (
        (await existingPaymentByKey(database, actorProfileId, input)) ?? {
          status: "REFERENCE_CONFLICT",
        }
      );
    }
    throw error;
  }
}

export async function confirmPaymentRecord(
  database: Database,
  actorProfileId: string,
  input: ConfirmPaymentInput,
): Promise<FinanceRepositoryResult> {
  const result = await database.execute<MutationRow>(sql`
    with confirmed as (
      update ${payments} payment
      set status = 'CONFIRMED', confirmed_at = now(),
        confirmed_by_profile_id = ${actorProfileId}::uuid,
        updated_at = now(), version = payment.version + 1
      where payment.payment_reference = ${input.paymentReference}
        and payment.version = ${input.expectedVersion}
        and payment.status = 'RECORDED'
        and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
      returning payment.id, payment.payment_reference, payment.version
    ),
    audit as (
      insert into ${financeAuditEvents} (
        payment_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select confirmed.id, 'PAYMENT_CONFIRMED', ${actorProfileId}::uuid,
        'STAFF', 'RECORDED', 'CONFIRMED',
        jsonb_build_object(
          'paymentReference', confirmed.payment_reference,
          'paymentVersion', confirmed.version
        )
      from confirmed returning payment_id
    )
    select 'UPDATED'::text as result, null::text as "invoiceReference",
      null::text as "invoiceNumber",
      confirmed.payment_reference as "paymentReference",
      '[]'::jsonb as "reasonCodes"
    from confirmed where exists (select 1 from audit)
  `);
  if (result.rows[0]) return mutationResult(result.rows[0]);
  const current = await database.execute<{ status: string }>(sql`
    select payment.status
    from ${payments} payment
    where payment.payment_reference = ${input.paymentReference}
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
    limit 1
  `);
  if (!current.rows[0]) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (current.rows[0].status === "CONFIRMED") {
    return { status: "NO_CHANGE", paymentReference: input.paymentReference };
  }
  return current.rows[0].status === "RECORDED"
    ? { status: "CONFLICT" }
    : { status: "INVALID_TRANSITION" };
}

function allocationFingerprint(input: AllocatePaymentInput): SQL {
  return sql`encode(sha256(convert_to(jsonb_build_object(
    'paymentReference', ${input.paymentReference}::text,
    'invoiceReference', ${input.invoiceReference}::text,
    'amountMinorUnits', ${input.amountMinorUnits}::integer
  )::text, 'UTF8')), 'hex')`;
}

async function classifyAllocationFailure(
  database: Database,
  actorProfileId: string,
  input: AllocatePaymentInput,
): Promise<FinanceRepositoryResult> {
  const state = await database.execute<{
    paymentStatus: string;
    invoiceStatus: string;
  }>(sql`
    select payment.status as "paymentStatus",
      invoice.status as "invoiceStatus"
    from ${payments} payment
    cross join ${invoices} invoice
    where payment.payment_reference = ${input.paymentReference}
      and invoice.invoice_reference = ${input.invoiceReference}
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
    limit 1
  `);
  const row = state.rows[0];
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (
    row.paymentStatus !== "CONFIRMED" ||
    !["ISSUED", "PARTIALLY_PAID"].includes(row.invoiceStatus)
  ) {
    return { status: "INVALID_TRANSITION" };
  }
  return { status: "CONFLICT" };
}

/**
 * Locks the payment first and the invoice second. Reversal uses the same order,
 * preventing allocation/reversal races while the database remains the source
 * of every balance and lifecycle decision.
 */
export async function allocatePaymentRecord(
  database: Database,
  actorProfileId: string,
  input: AllocatePaymentInput,
): Promise<FinanceRepositoryResult> {
  const fingerprint = allocationFingerprint(input);
  try {
    const [, , result] = await database.batch([
      database.execute(sql`set transaction isolation level read committed`),
      database.execute(sql`
        select payment.id
        from ${payments} payment
        where payment.payment_reference = ${input.paymentReference}
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
        for update of payment
      `),
      database.execute<MutationRow>(sql`
        with invoice_lock as materialized (
          select invoice.id, invoice.invoice_reference,
            invoice.customer_id, invoice.currency, invoice.status,
            invoice.gross_total_minor_units,
            invoice.paid_amount_minor_units
          from ${invoices} invoice
          where invoice.invoice_reference = ${input.invoiceReference}
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
          for update of invoice
        ),
        existing as materialized (
          select case
              when allocation.idempotency_fingerprint = ${fingerprint}
                then 'NO_CHANGE'
              else 'IDEMPOTENCY_CONFLICT'
            end as result,
            invoice.invoice_reference,
            payment.payment_reference
          from ${paymentAllocations} allocation
          join ${payments} payment on payment.id = allocation.payment_id
          join ${invoices} invoice on invoice.id = allocation.invoice_id
          where allocation.idempotency_key = ${input.idempotencyKey}::uuid
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
          limit 1
        ),
        target as materialized (
          select payment.id as payment_id, payment.payment_reference,
            payment.customer_id, payment.currency,
            invoice_lock.id as invoice_id, invoice_lock.invoice_reference,
            invoice_lock.status as previous_invoice_status,
            invoice_lock.gross_total_minor_units,
            invoice_lock.paid_amount_minor_units
          from ${payments} payment
          join invoice_lock
            on invoice_lock.customer_id = payment.customer_id
           and invoice_lock.currency = payment.currency
          where payment.payment_reference = ${input.paymentReference}
            and invoice_lock.invoice_reference = ${input.invoiceReference}
            and payment.status = 'CONFIRMED'
            and invoice_lock.status in ('ISSUED', 'PARTIALLY_PAID')
            and ${input.amountMinorUnits} <=
              payment.amount_minor_units - payment.allocated_amount_minor_units
            and ${input.amountMinorUnits} <=
              invoice_lock.gross_total_minor_units -
                invoice_lock.paid_amount_minor_units
            and not exists (select 1 from existing)
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
        ),
        inserted as (
          insert into ${paymentAllocations} (
            allocation_reference, entry_type, payment_id, invoice_id,
            customer_id, currency, amount_minor_units,
            idempotency_key, idempotency_fingerprint,
            allocated_by_profile_id
          )
          select 'PAL-' || upper(substr(
              replace(gen_random_uuid()::text, '-', ''), 1, 24
            )),
            'ALLOCATION', target.payment_id, target.invoice_id,
            target.customer_id, target.currency, ${input.amountMinorUnits},
            ${input.idempotencyKey}::uuid, ${fingerprint},
            ${actorProfileId}::uuid
          from target
          returning id, payment_id, invoice_id, amount_minor_units
        ),
        payment_updated as (
          update ${payments} payment
          set allocated_amount_minor_units =
                payment.allocated_amount_minor_units + inserted.amount_minor_units,
            updated_at = now(), version = payment.version + 1
          from inserted
          where payment.id = inserted.payment_id
          returning payment.id, payment.payment_reference, payment.version
        ),
        invoice_updated as (
          update ${invoices} invoice
          set paid_amount_minor_units =
                invoice.paid_amount_minor_units + inserted.amount_minor_units,
            status = case
              when invoice.paid_amount_minor_units + inserted.amount_minor_units =
                invoice.gross_total_minor_units then 'PAID'
              else 'PARTIALLY_PAID'
            end,
            updated_at = now(), version = invoice.version + 1
          from inserted, target
          where invoice.id = inserted.invoice_id
          returning invoice.id, invoice.invoice_reference, invoice.status,
            invoice.version, target.previous_invoice_status
        ),
        payment_audit as (
          insert into ${financeAuditEvents} (
            invoice_id, payment_id, payment_allocation_id, event_type,
            actor_profile_id, source, previous_status, next_status,
            safe_metadata
          )
          select inserted.invoice_id, inserted.payment_id, inserted.id,
            'PAYMENT_ALLOCATED', ${actorProfileId}::uuid, 'STAFF',
            'CONFIRMED', 'CONFIRMED',
            jsonb_build_object(
              'paymentReference', payment_updated.payment_reference,
              'invoiceReference', invoice_updated.invoice_reference,
              'paymentVersion', payment_updated.version,
              'invoiceVersion', invoice_updated.version,
              'amountMinorUnits', inserted.amount_minor_units
            )
          from inserted, payment_updated, invoice_updated
          returning payment_allocation_id
        ),
        invoice_audit as (
          insert into ${financeAuditEvents} (
            invoice_id, payment_id, payment_allocation_id, event_type,
            actor_profile_id, source, previous_status, next_status,
            safe_metadata
          )
          select invoice_updated.id, inserted.payment_id, inserted.id,
            case when invoice_updated.status = 'PAID'
              then 'INVOICE_PAID' else 'INVOICE_PARTIALLY_PAID' end,
            ${actorProfileId}::uuid, 'STAFF',
            invoice_updated.previous_invoice_status, invoice_updated.status,
            jsonb_build_object(
              'invoiceReference', invoice_updated.invoice_reference,
              'paymentVersion', payment_updated.version,
              'invoiceVersion', invoice_updated.version,
              'amountMinorUnits', inserted.amount_minor_units
            )
          from inserted, invoice_updated, payment_updated
          returning invoice_id
        ),
        completed as (
          select 'UPDATED'::text as result,
            invoice_updated.invoice_reference,
            payment_updated.payment_reference
          from invoice_updated, payment_updated
          where exists (select 1 from payment_audit)
            and exists (select 1 from invoice_audit)
        )
        select existing.result,
          existing.invoice_reference as "invoiceReference",
          null::text as "invoiceNumber",
          existing.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from existing
        union all
        select completed.result,
          completed.invoice_reference as "invoiceReference",
          null::text as "invoiceNumber",
          completed.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from completed
      `),
    ]);
    if (result.rows[0]) return mutationResult(result.rows[0]);
    return classifyAllocationFailure(database, actorProfileId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await database.execute<MutationRow>(sql`
        select case when allocation.idempotency_fingerprint = ${fingerprint}
            then 'NO_CHANGE' else 'IDEMPOTENCY_CONFLICT' end as result,
          invoice.invoice_reference as "invoiceReference",
          null::text as "invoiceNumber",
          payment.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from ${paymentAllocations} allocation
        join ${payments} payment on payment.id = allocation.payment_id
        join ${invoices} invoice on invoice.id = allocation.invoice_id
        where allocation.idempotency_key = ${input.idempotencyKey}::uuid
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "PAYMENT_RECORD")}
        limit 1
      `);
      return existing.rows[0]
        ? mutationResult(existing.rows[0])
        : { status: "CONFLICT" };
    }
    throw error;
  }
}

function reversalFingerprint(input: ReversePaymentInput): SQL {
  return sql`encode(sha256(convert_to(jsonb_build_object(
    'paymentReference', ${input.paymentReference}::text,
    'expectedVersion', ${input.expectedVersion}::integer,
    'reasonCategory', ${input.reasonCategory}::text,
    'reasonNote', ${input.reasonNote}::text
  )::text, 'UTF8')), 'hex')`;
}

async function classifyReversalFailure(
  database: Database,
  actorProfileId: string,
  input: ReversePaymentInput,
): Promise<FinanceRepositoryResult> {
  const state = await database.execute<{ status: string; version: number }>(sql`
    select payment.status, payment.version
    from ${payments} payment
    where payment.payment_reference = ${input.paymentReference}
      and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
    limit 1
  `);
  const row = state.rows[0];
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (row.status === "REVERSED") return { status: "INVALID_TRANSITION" };
  return { status: "CONFLICT" };
}

/**
 * Reversal never deletes ledger history. It appends one payment reversal and
 * one compensating allocation row per still-effective allocation, then derives
 * the restored invoice balances inside the same payment-first transaction.
 */
export async function reversePaymentRecord(
  database: Database,
  actorProfileId: string,
  input: ReversePaymentInput,
): Promise<FinanceRepositoryResult> {
  const fingerprint = reversalFingerprint(input);
  try {
    const [, , , result] = await database.batch([
      database.execute(sql`set transaction isolation level read committed`),
      database.execute(sql`
        select payment.id
        from ${payments} payment
        where payment.payment_reference = ${input.paymentReference}
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
        for update of payment
      `),
      database.execute(sql`
        select invoice.id
        from ${invoices} invoice
        join (
          select distinct allocation.invoice_id
          from ${payments} payment
          join ${paymentAllocations} allocation
            on allocation.payment_id = payment.id
           and allocation.entry_type = 'ALLOCATION'
          where payment.payment_reference = ${input.paymentReference}
            and not exists (
              select 1 from ${paymentAllocations} compensation
              where compensation.reverses_allocation_id = allocation.id
            )
        ) active on active.invoice_id = invoice.id
        where ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
        order by invoice.id
        for update of invoice
      `),
      database.execute<MutationRow>(sql`
        with active_invoice_ids as materialized (
          select distinct allocation.invoice_id
          from ${payments} payment
          join ${paymentAllocations} allocation
            on allocation.payment_id = payment.id
           and allocation.entry_type = 'ALLOCATION'
          where payment.payment_reference = ${input.paymentReference}
            and not exists (
              select 1 from ${paymentAllocations} compensation
              where compensation.reverses_allocation_id = allocation.id
            )
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
        ),
        invoice_locks as materialized (
          select invoice.id, invoice.status,
            invoice.paid_amount_minor_units,
            invoice.gross_total_minor_units
          from ${invoices} invoice
          join active_invoice_ids active on active.invoice_id = invoice.id
          order by invoice.id
          for update of invoice
        ),
        existing as materialized (
          select case
              when reversal.idempotency_fingerprint = ${fingerprint}
                then 'NO_CHANGE'
              else 'IDEMPOTENCY_CONFLICT'
            end as result,
            payment.payment_reference
          from ${paymentReversals} reversal
          join ${payments} payment on payment.id = reversal.payment_id
          where reversal.idempotency_key = ${input.idempotencyKey}::uuid
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
          limit 1
        ),
        target as materialized (
          select payment.id, payment.payment_reference, payment.customer_id,
            payment.currency, payment.amount_minor_units,
            payment.allocated_amount_minor_units, payment.status
          from ${payments} payment
          where payment.payment_reference = ${input.paymentReference}
            and payment.version = ${input.expectedVersion}
            and payment.status in ('RECORDED', 'CONFIRMED')
            and not exists (select 1 from existing)
            and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
        ),
        active_allocations as materialized (
          select allocation.*
          from ${paymentAllocations} allocation
          join target on target.id = allocation.payment_id
          join invoice_locks on invoice_locks.id = allocation.invoice_id
          where allocation.entry_type = 'ALLOCATION'
            and not exists (
              select 1 from ${paymentAllocations} compensation
              where compensation.reverses_allocation_id = allocation.id
            )
        ),
        invoice_deltas as materialized (
          select allocation.invoice_id,
            invoice_locks.status as previous_invoice_status,
            sum(allocation.amount_minor_units)::integer as amount_minor_units
          from active_allocations allocation
          join invoice_locks on invoice_locks.id = allocation.invoice_id
          group by allocation.invoice_id, invoice_locks.status
        ),
        ledger_safe as materialized (
          select target.*
          from target
          where target.allocated_amount_minor_units = coalesce((
              select sum(allocation.amount_minor_units)::integer
              from active_allocations allocation
            ), 0)
            and not exists (
              select 1
              from invoice_deltas delta
              join invoice_locks on invoice_locks.id = delta.invoice_id
              where invoice_locks.paid_amount_minor_units <
                    delta.amount_minor_units
                or invoice_locks.paid_amount_minor_units <> coalesce((
                  select sum(case
                    when ledger.entry_type = 'ALLOCATION'
                      then ledger.amount_minor_units
                    else -ledger.amount_minor_units
                  end)::integer
                  from ${paymentAllocations} ledger
                  where ledger.invoice_id = invoice_locks.id
                ), 0)
            )
        ),
        inserted_reversal as (
          insert into ${paymentReversals} (
            reversal_reference, payment_id, customer_id, currency,
            amount_minor_units, reason_category, reason_text,
            idempotency_key, idempotency_fingerprint,
            reversed_by_profile_id
          )
          select 'PRV-' || upper(substr(
              replace(gen_random_uuid()::text, '-', ''), 1, 24
            )),
            target.id, target.customer_id, target.currency,
            target.amount_minor_units, ${input.reasonCategory},
            ${input.reasonNote}, ${input.idempotencyKey}::uuid,
            ${fingerprint}, ${actorProfileId}::uuid
          from ledger_safe target
          returning id, payment_id, reversal_reference
        ),
        compensations as (
          insert into ${paymentAllocations} (
            allocation_reference, entry_type, payment_id, invoice_id,
            customer_id, currency, amount_minor_units,
            reverses_allocation_id, reversed_entry_type,
            idempotency_key, idempotency_fingerprint,
            allocated_by_profile_id
          )
          select 'PAL-' || upper(substr(
              replace(gen_random_uuid()::text, '-', ''), 1, 24
            )),
            'REVERSAL', allocation.payment_id, allocation.invoice_id,
            allocation.customer_id, allocation.currency,
            allocation.amount_minor_units, allocation.id, 'ALLOCATION',
            gen_random_uuid(), ${fingerprint}, ${actorProfileId}::uuid
          from active_allocations allocation
          join inserted_reversal on inserted_reversal.payment_id = allocation.payment_id
          returning id, payment_id, invoice_id, amount_minor_units
        ),
        invoices_updated as (
          update ${invoices} invoice
          set paid_amount_minor_units =
                invoice.paid_amount_minor_units - delta.amount_minor_units,
            status = case
              when invoice.paid_amount_minor_units - delta.amount_minor_units = 0
                then 'ISSUED'
              else 'PARTIALLY_PAID'
            end,
            updated_at = now(), version = invoice.version + 1
          from invoice_deltas delta, inserted_reversal
          where invoice.id = delta.invoice_id
            and invoice.paid_amount_minor_units >= delta.amount_minor_units
          returning invoice.id, invoice.invoice_reference, invoice.status,
            invoice.version, delta.previous_invoice_status
        ),
        payment_updated as (
          update ${payments} payment
          set status = 'REVERSED', allocated_amount_minor_units = 0,
            reversed_at = now(), reversed_by_profile_id = ${actorProfileId}::uuid,
            updated_at = now(), version = payment.version + 1
          from ledger_safe target, inserted_reversal
          where payment.id = target.id
          returning payment.id, payment.payment_reference, payment.version,
            target.status as previous_status
        ),
        allocation_audit as (
          insert into ${financeAuditEvents} (
            invoice_id, payment_id, payment_allocation_id,
            payment_reversal_id, event_type, actor_profile_id, source,
            previous_status, next_status, safe_metadata
          )
          select compensation.invoice_id, compensation.payment_id,
            compensation.id, inserted_reversal.id,
            'PAYMENT_ALLOCATION_REVERSED', ${actorProfileId}::uuid,
            'STAFF', invoices_updated.previous_invoice_status,
            invoices_updated.status, jsonb_build_object(
              'paymentReference', payment_updated.payment_reference,
              'paymentVersion', payment_updated.version,
              'invoiceVersion', invoices_updated.version,
              'amountMinorUnits', compensation.amount_minor_units
            )
          from compensations compensation
          join invoices_updated
            on invoices_updated.id = compensation.invoice_id
          cross join inserted_reversal
          cross join payment_updated
          returning payment_allocation_id
        ),
        payment_audit as (
          insert into ${financeAuditEvents} (
            payment_id, payment_reversal_id, event_type,
            actor_profile_id, source, previous_status, next_status,
            safe_metadata
          )
          select payment_updated.id, inserted_reversal.id,
            'PAYMENT_REVERSED', ${actorProfileId}::uuid, 'STAFF',
            payment_updated.previous_status, 'REVERSED',
            jsonb_build_object(
              'paymentReference', payment_updated.payment_reference,
              'paymentVersion', payment_updated.version,
              'reasonCategory', ${input.reasonCategory}::text
            )
          from payment_updated, inserted_reversal
          returning payment_id
        ),
        completed as (
          select 'UPDATED'::text as result,
            payment_updated.payment_reference
          from payment_updated
          where exists (select 1 from payment_audit)
            and (
              not exists (select 1 from active_allocations)
              or exists (select 1 from allocation_audit)
            )
            and (select count(*) from invoices_updated) =
              (select count(*) from invoice_deltas)
        )
        select existing.result,
          null::text as "invoiceReference",
          null::text as "invoiceNumber",
          existing.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from existing
        union all
        select completed.result,
          null::text as "invoiceReference",
          null::text as "invoiceNumber",
          completed.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from completed
      `),
    ]);
    if (result.rows[0]) return mutationResult(result.rows[0]);
    return classifyReversalFailure(database, actorProfileId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await database.execute<MutationRow>(sql`
        select case when reversal.idempotency_fingerprint = ${fingerprint}
            then 'NO_CHANGE' else 'IDEMPOTENCY_CONFLICT' end as result,
          null::text as "invoiceReference", null::text as "invoiceNumber",
          payment.payment_reference as "paymentReference",
          '[]'::jsonb as "reasonCodes"
        from ${paymentReversals} reversal
        join ${payments} payment on payment.id = reversal.payment_id
        where reversal.idempotency_key = ${input.idempotencyKey}::uuid
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD")}
        limit 1
      `);
      return existing.rows[0]
        ? mutationResult(existing.rows[0])
        : { status: "CONFLICT" };
    }
    throw error;
  }
}

type InvoiceSummaryRow = {
  invoiceReference: string;
  invoiceNumber: string | null;
  type: string;
  status: string;
  customerDisplayName: string;
  bookingReference: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  grossAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  outstandingAmountMinorUnits: number;
  createdAt: Date;
  version: number;
};

type InvoiceDetailRow = InvoiceSummaryRow & {
  quoteReference: string;
  customerSnapshot: unknown;
  sellerSnapshot: unknown;
  termsSnapshot: unknown;
  commercialSnapshot: unknown;
  provenanceSnapshot: unknown;
  eligibilitySnapshot: unknown;
  customerVisibleNote: string | null;
  internalNote: string | null;
  jobReference: string | null;
  reviewReasonCodes: unknown;
};

type InvoiceItemRow = {
  descriptionBg: string;
  descriptionEn: string;
  quantity: number;
  measurementSnapshot: unknown;
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossAmountMinorUnits: number;
  sortOrder: number;
};

type FinanceAuditRow = {
  eventType: string;
  source: string;
  safeMetadata: unknown;
  createdAt: Date;
};

type PaymentSummaryRow = {
  paymentReference: string;
  status: string;
  method: string;
  currency: string;
  amountMinorUnits: number;
  allocatedAmountMinorUnits: number;
  unappliedAmountMinorUnits: number;
  receivedAt: Date;
  createdAt: Date;
  version: number;
};

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function invoiceSummary(row: InvoiceSummaryRow, today: string): InvoiceSummary {
  const storedStatus = row.status as InvoiceStoredStatus;
  return {
    invoiceReference: row.invoiceReference,
    invoiceNumber: row.invoiceNumber,
    type: row.type as InvoiceSummary["type"],
    status: displayInvoiceStatus(
      storedStatus,
      row.dueDate,
      today,
    ) as InvoiceDisplayStatus,
    customerDisplayName: row.customerDisplayName,
    bookingReference: row.bookingReference,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    currency: "EUR",
    grossAmountMinorUnits: row.grossAmountMinorUnits,
    paidAmountMinorUnits: row.paidAmountMinorUnits,
    outstandingAmountMinorUnits: row.outstandingAmountMinorUnits,
    createdAt: row.createdAt,
    version: row.version,
  };
}

const invoiceSummaryColumns = sql`
  invoice.invoice_reference as "invoiceReference",
  invoice.invoice_number as "invoiceNumber",
  invoice.type,
  invoice.status,
  coalesce(invoice.customer_snapshot ->> 'billingName', customer.display_name)
    as "customerDisplayName",
  booking.booking_reference as "bookingReference",
  invoice.issue_date as "issueDate",
  invoice.due_date as "dueDate",
  invoice.currency,
  invoice.gross_total_minor_units as "grossAmountMinorUnits",
  invoice.paid_amount_minor_units as "paidAmountMinorUnits",
  invoice.outstanding_amount_minor_units as "outstandingAmountMinorUnits",
  invoice.created_at as "createdAt",
  invoice.version
`;

function staffStatusFilter(status: StaffInvoiceListInput["status"]): SQL {
  if (!status) return sql`true`;
  if (status === "OVERDUE") {
    return sql`invoice.status in ('ISSUED', 'PARTIALLY_PAID')
      and invoice.outstanding_amount_minor_units > 0
      and invoice.due_date < (now() at time zone 'Europe/Sofia')::date`;
  }
  return sql`invoice.status = ${status}`;
}

export async function dashboardRecord(
  database: Database,
  actorProfileId: string,
  today: string,
): Promise<FinanceDashboard> {
  const result = await database.execute<FinanceDashboard>(sql`
    select
      count(*) filter (where invoice.status in ('DRAFT', 'READY_TO_ISSUE'))::integer
        as "draftInvoices",
      count(*) filter (where invoice.status = 'ISSUED')::integer
        as "issuedUnpaidInvoices",
      count(*) filter (where invoice.status = 'PARTIALLY_PAID')::integer
        as "partiallyPaidInvoices",
      count(*) filter (where invoice.status in ('ISSUED', 'PARTIALLY_PAID')
        and invoice.outstanding_amount_minor_units > 0
        and invoice.due_date < ${today}::date)::integer as "overdueInvoices",
      count(*) filter (where invoice.status = 'PAID')::integer as "paidInvoices",
      (select count(*)::integer from ${payments} payment
        where payment.status in ('RECORDED', 'CONFIRMED')
          and payment.unallocated_amount_minor_units > 0
          and ${staffPermissionSql(actorProfileId, "FINANCE_READ")})
        as "unappliedPayments",
      coalesce(sum(invoice.gross_total_minor_units) filter (
        where invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
      ), 0)::integer as "invoicedGrossMinorUnits",
      coalesce(sum(invoice.paid_amount_minor_units) filter (
        where invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
      ), 0)::integer as "paidMinorUnits",
      coalesce(sum(invoice.outstanding_amount_minor_units) filter (
        where invoice.status in ('ISSUED', 'PARTIALLY_PAID')
      ), 0)::integer as "outstandingMinorUnits",
      coalesce(sum(invoice.outstanding_amount_minor_units) filter (
        where invoice.status in ('ISSUED', 'PARTIALLY_PAID')
          and invoice.due_date < ${today}::date
      ), 0)::integer as "overdueMinorUnits",
      'EUR'::text as currency
    from ${invoices} invoice
    where ${staffPermissionSql(actorProfileId, "FINANCE_READ")}
  `);
  return (
    result.rows[0] ?? {
      draftInvoices: 0,
      issuedUnpaidInvoices: 0,
      partiallyPaidInvoices: 0,
      overdueInvoices: 0,
      paidInvoices: 0,
      unappliedPayments: 0,
      invoicedGrossMinorUnits: 0,
      paidMinorUnits: 0,
      outstandingMinorUnits: 0,
      overdueMinorUnits: 0,
      currency: "EUR",
    }
  );
}

export async function listStaffInvoicesRecord(
  database: Database,
  actorProfileId: string,
  input: StaffInvoiceListInput,
  today: string,
): Promise<StaffInvoicePage> {
  const search = input.search ? `%${input.search}%` : null;
  const where = sql`${staffPermissionSql(actorProfileId, "FINANCE_READ")}
    and ${staffStatusFilter(input.status)}
    and (${search}::text is null
      or invoice.invoice_reference ilike ${search}
      or invoice.invoice_number ilike ${search}
      or booking.booking_reference ilike ${search}
      or coalesce(invoice.customer_snapshot ->> 'billingName', customer.display_name)
        ilike ${search})`;
  const [rows, count] = await database.batch([
    database.execute<InvoiceSummaryRow>(sql`
      select ${invoiceSummaryColumns}
      from ${invoices} invoice
      join ${bookings} booking on booking.id = invoice.booking_id
      join ${customers} customer on customer.id = invoice.customer_id
      where ${where}
      order by invoice.created_at desc, invoice.id desc
      limit ${input.limit} offset ${input.offset}
    `),
    database.execute<{ total: number }>(sql`
      select count(*)::integer as total
      from ${invoices} invoice
      join ${bookings} booking on booking.id = invoice.booking_id
      join ${customers} customer on customer.id = invoice.customer_id
      where ${where}
    `),
  ]);
  return {
    items: rows.rows.map((row) => invoiceSummary(row, today)),
    total: count.rows[0]?.total ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

async function invoiceDetailRows(
  database: Database,
  access: SQL,
  invoiceReference: string,
  includeStaffFields: boolean,
): Promise<
  readonly [InvoiceDetailRow | undefined, readonly InvoiceLineSnapshot[], readonly FinanceAuditItem[]]
> {
  const [detail, items, audit] = await database.batch([
    database.execute<InvoiceDetailRow>(sql`
      select ${invoiceSummaryColumns},
        quote.quote_reference as "quoteReference",
        invoice.customer_snapshot as "customerSnapshot",
        invoice.seller_snapshot as "sellerSnapshot",
        invoice.terms_snapshot as "termsSnapshot",
        ${includeStaffFields ? sql`invoice.commercial_snapshot` : sql`'{}'::jsonb`}
          as "commercialSnapshot",
        ${includeStaffFields ? sql`invoice.provenance_snapshot` : sql`'{}'::jsonb`}
          as "provenanceSnapshot",
        ${includeStaffFields ? sql`invoice.eligibility_snapshot` : sql`'{}'::jsonb`}
          as "eligibilitySnapshot",
        invoice.customer_visible_notes as "customerVisibleNote",
        ${includeStaffFields ? sql`invoice.internal_notes` : sql`null::text`}
          as "internalNote",
        ${includeStaffFields ? sql`job.job_reference` : sql`null::text`}
          as "jobReference",
        ${includeStaffFields ? sql`invoice.finance_review_reason_codes` : sql`'[]'::jsonb`}
          as "reviewReasonCodes"
      from ${invoices} invoice
      join ${bookings} booking on booking.id = invoice.booking_id
      join ${quotes} quote on quote.id = invoice.quote_id
      join ${customers} customer on customer.id = invoice.customer_id
      left join ${jobs} job on job.id = invoice.job_id
      where invoice.invoice_reference = ${invoiceReference}
        and ${access}
      limit 1
    `),
    database.execute<InvoiceItemRow>(sql`
      select item.description_bg as "descriptionBg",
        item.description_en as "descriptionEn", item.quantity,
        item.measurement_snapshot as "measurementSnapshot",
        item.net_amount_minor_units as "netAmountMinorUnits",
        item.vat_rate_basis_points as "vatRateBasisPoints",
        item.vat_amount_minor_units as "vatAmountMinorUnits",
        item.gross_total_minor_units as "grossAmountMinorUnits",
        item.sort_order as "sortOrder"
      from ${invoiceItems} item
      join ${invoices} invoice on invoice.id = item.invoice_id
      where invoice.invoice_reference = ${invoiceReference}
        and ${access}
      order by item.sort_order, item.id
    `),
    includeStaffFields
      ? database.execute<FinanceAuditRow>(sql`
          select event.event_type as "eventType", event.source,
            event.safe_metadata as "safeMetadata", event.created_at as "createdAt"
          from ${financeAuditEvents} event
          join ${invoices} invoice on invoice.id = event.invoice_id
          where invoice.invoice_reference = ${invoiceReference}
            and ${access}
          order by event.created_at, event.id
        `)
      : database.execute<FinanceAuditRow>(sql`
          select null::text as "eventType", null::text as source,
            '{}'::jsonb as "safeMetadata", now() as "createdAt"
          where false
        `),
  ]);
  return [
    detail.rows[0],
    items.rows.map((row) => ({
      ...row,
      measurementSnapshot: object(row.measurementSnapshot),
    })),
    audit.rows.map((row) => ({
      eventType: row.eventType,
      source: row.source as FinanceAuditItem["source"],
      safeMetadata: object(row.safeMetadata),
      createdAt: row.createdAt,
    })),
  ];
}

function customerDetail(
  row: InvoiceDetailRow,
  items: readonly InvoiceLineSnapshot[],
  today: string,
): CustomerInvoiceDetail {
  const sellerSnapshot = object(row.sellerSnapshot);
  const instructions = sellerSnapshot.paymentInstructions;
  return {
    ...invoiceSummary(row, today),
    quoteReference: row.quoteReference,
    customerSnapshot: object(row.customerSnapshot),
    sellerSnapshot,
    termsSnapshot: object(row.termsSnapshot),
    customerVisibleNote: row.customerVisibleNote,
    items,
    paymentInstructions:
      typeof instructions === "string" && instructions.trim()
        ? instructions.trim()
        : null,
  };
}

export async function getStaffInvoiceRecord(
  database: Database,
  actorProfileId: string,
  invoiceReference: string,
  today: string,
): Promise<StaffInvoiceDetail | null> {
  const [row, items, auditTimeline] = await invoiceDetailRows(
    database,
    staffPermissionSql(actorProfileId, "FINANCE_READ"),
    invoiceReference,
    true,
  );
  if (!row) return null;
  const eligibility = object(row.eligibilitySnapshot).issueEligibility;
  return {
    ...customerDetail(row, items, today),
    eligibilityMode:
      eligibility === "JOB_COMPLETED"
        ? "JOB_COMPLETION_REQUIRED"
        : "BOOKING_ACCEPTED",
    jobReference: row.jobReference,
    reviewReasonCodes: reviewReasons(row.reviewReasonCodes),
    commercialSnapshot: object(row.commercialSnapshot),
    provenanceSnapshot: object(row.provenanceSnapshot),
    internalNote: row.internalNote,
    auditTimeline,
  };
}

export async function listCustomerInvoicesRecord(
  database: Database,
  actorProfileId: string,
  today: string,
): Promise<readonly InvoiceSummary[]> {
  const result = await database.execute<InvoiceSummaryRow>(sql`
    select ${invoiceSummaryColumns}
    from ${invoices} invoice
    join ${bookings} booking on booking.id = invoice.booking_id
    join ${customers} customer on customer.id = invoice.customer_id
    where invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
      and ${customerInvoiceAccessSql(actorProfileId, sql`invoice.customer_id`)}
    order by invoice.created_at desc, invoice.id desc
  `);
  return result.rows.map((row) => invoiceSummary(row, today));
}

export async function getCustomerInvoiceRecord(
  database: Database,
  actorProfileId: string,
  invoiceReference: string,
  today: string,
): Promise<CustomerInvoiceDetail | null> {
  const [row, items] = await invoiceDetailRows(
    database,
    sql`invoice.status in ('ISSUED', 'PARTIALLY_PAID', 'PAID')
      and ${customerInvoiceAccessSql(actorProfileId, sql`invoice.customer_id`)}`,
    invoiceReference,
    false,
  );
  return row ? customerDetail(row, items, today) : null;
}

export async function listPaymentsRecord(
  database: Database,
  actorProfileId: string,
): Promise<readonly PaymentSummary[]> {
  const result = await database.execute<PaymentSummaryRow>(sql`
    select payment.payment_reference as "paymentReference",
      payment.status, payment.method, payment.currency,
      payment.amount_minor_units as "amountMinorUnits",
      payment.allocated_amount_minor_units as "allocatedAmountMinorUnits",
      payment.unallocated_amount_minor_units as "unappliedAmountMinorUnits",
      payment.received_at as "receivedAt", payment.created_at as "createdAt",
      payment.version
    from ${payments} payment
    where ${staffPermissionSql(actorProfileId, "FINANCE_READ")}
    order by payment.received_at desc, payment.id desc
  `);
  return result.rows.map((row) => ({
    paymentReference: row.paymentReference,
    status: row.status as PaymentStatus,
    method: row.method as PaymentMethod,
    currency: "EUR",
    amountMinorUnits: row.amountMinorUnits,
    allocatedAmountMinorUnits: row.allocatedAmountMinorUnits,
    unappliedAmountMinorUnits: row.unappliedAmountMinorUnits,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
    version: row.version,
  }));
}

export function createDatabaseFinanceRepository(
  database: Database,
): FinanceRepository {
  return {
    createInvoiceDraft: (actorProfileId, input) =>
      createInvoiceDraftRecord(database, actorProfileId, input),
    issueInvoice: (actorProfileId, input) =>
      issueInvoiceRecord(database, actorProfileId, input),
    cancelDraftInvoice: (actorProfileId, input) =>
      cancelDraftInvoiceRecord(database, actorProfileId, input),
    recordPayment: (actorProfileId, input) =>
      recordPaymentRecord(database, actorProfileId, input),
    confirmPayment: (actorProfileId, input) =>
      confirmPaymentRecord(database, actorProfileId, input),
    allocatePayment: (actorProfileId, input) =>
      allocatePaymentRecord(database, actorProfileId, input),
    reversePayment: (actorProfileId, input) =>
      reversePaymentRecord(database, actorProfileId, input),
    dashboard: (actorProfileId, today) =>
      dashboardRecord(database, actorProfileId, today),
    listStaffInvoices: (actorProfileId, input, today) =>
      listStaffInvoicesRecord(database, actorProfileId, input, today),
    getStaffInvoice: (actorProfileId, invoiceReference, today) =>
      getStaffInvoiceRecord(database, actorProfileId, invoiceReference, today),
    listCustomerInvoices: (actorProfileId, today) =>
      listCustomerInvoicesRecord(database, actorProfileId, today),
    getCustomerInvoice: (actorProfileId, invoiceReference, today) =>
      getCustomerInvoiceRecord(database, actorProfileId, invoiceReference, today),
    listPayments: (actorProfileId) =>
      listPaymentsRecord(database, actorProfileId),
  };
}
