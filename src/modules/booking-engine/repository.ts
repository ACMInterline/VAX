import "server-only";

import { and, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  bookingAuditEvents,
  bookingItems,
  bookingOccupancies,
  bookings,
  quoteAcceptances,
} from "@/db/schema/booking-engine";
import {
  operationsTeams,
  travelTimeProfiles,
  workingHourPolicies,
} from "@/db/schema/availability-engine";
import {
  customerIdentityLinks,
  customers,
  properties,
} from "@/db/schema/customer-crm";
import { jobs } from "@/db/schema/job-execution";
import {
  quoteItems,
  quotes,
  requestEstimates,
  serviceRequestItemAddons,
  serviceRequestItemIssues,
  serviceRequestItems,
  serviceRequests,
} from "@/db/schema/request-quote";
import { travelZones } from "@/db/schema/commercial-engine";
import {
  activeActorPermissionSql,
  completeEstimateEvidenceSql,
  priceSnapshotSha256Sql,
  staffRequestManageSql,
} from "@/modules/request-quote/repository";
import type {
  AcceptanceRepositoryInput,
  AcceptanceRepositoryResult,
  BookingOccupancyBlock,
  CancellationReasonCategory,
  CancellationRepositoryResult,
  CustomerBookingDetail,
  CustomerBookingSummary,
  QuoteAcceptancePreview,
  StaffBookingDetail,
  StaffBookingListInput,
  StaffBookingPage,
  StaffBookingSummary,
} from "./types";

type AcceptanceRow = {
  result: string;
  bookingReference: string | null;
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
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function staffReadSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
    activeActorPermissionSql(actorProfileId, "SCHEDULE_READ"),
  )!;
}

function staffScheduleSql(actorProfileId: string): SQL {
  return and(
    staffRequestManageSql(actorProfileId),
    activeActorPermissionSql(actorProfileId, "SCHEDULE_MANAGE"),
  )!;
}

function customerAccessSql(
  actorProfileId: string,
  customerId: SQL,
  permission: "OWN_CUSTOMER_DATA_READ" | "OWN_CUSTOMER_DATA_UPDATE",
): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, permission),
    sql`exists (
      select 1
      from ${customerIdentityLinks} exact_link
      join ${customers} linked_customer
        on linked_customer.id = exact_link.customer_id
       and linked_customer.status = 'ACTIVE'
      where exact_link.user_profile_id = ${actorProfileId}::uuid
        and exact_link.customer_id = ${customerId}
        and exact_link.active = true
        and exact_link.revoked_at is null
    )`,
  )!;
}

function acceptanceAccessSql(
  actorProfileId: string,
  actorType: AcceptanceRepositoryInput["actorType"],
): SQL {
  return actorType === "CUSTOMER"
    ? customerAccessSql(
        actorProfileId,
        sql`quote_record.customer_id`,
        "OWN_CUSTOMER_DATA_UPDATE",
      )
    : staffRequestManageSql(actorProfileId);
}

function acceptanceResult(row: AcceptanceRow | undefined): AcceptanceRepositoryResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (row.result === "REFERENCE_CONFLICT") {
    return { status: "REFERENCE_CONFLICT" };
  }
  if (
    (row.result === "CREATED" || row.result === "EXISTING") &&
    row.bookingReference
  ) {
    return { status: row.result, bookingReference: row.bookingReference };
  }
  return {
    status: "REVIEW_REQUIRED",
    reasonCodes: strings(row.reasonCodes).length
      ? strings(row.reasonCodes)
      : ["ACCEPTANCE_INTEGRITY_REVIEW_REQUIRED"],
  };
}

async function loadExistingAcceptanceRecord(
  database: Database,
  actorProfileId: string,
  input: AcceptanceRepositoryInput,
): Promise<AcceptanceRepositoryResult | null> {
  const access = acceptanceAccessSql(actorProfileId, input.actorType);
  const result = await database.execute<AcceptanceRow>(sql`
    select 'EXISTING'::text as result,
      booking.booking_reference as "bookingReference",
      '[]'::jsonb as "reasonCodes"
    from ${quotes} quote_record
    join ${quoteAcceptances} acceptance on acceptance.quote_id = quote_record.id
    join ${bookings} booking
      on booking.quote_acceptance_id = acceptance.id
     and booking.quote_id = quote_record.id
    where quote_record.quote_reference = ${input.quoteReference}
      and ${access}
    limit 1
  `);
  return result.rows[0] ? acceptanceResult(result.rows[0]) : null;
}

/**
 * Atomically consumes only the immutable issued-quote chain. This statement
 * never invokes a pricing, duration, normalization, or CRM repair path.
 */
export async function acceptQuoteRecord(
  database: Database,
  actorProfileId: string,
  input: AcceptanceRepositoryInput,
): Promise<AcceptanceRepositoryResult> {
  const access = acceptanceAccessSql(actorProfileId, input.actorType);
  try {
    const result = await database.execute<AcceptanceRow>(sql`
      with target as materialized (
        select quote_record.id as quote_id,
          quote_record.quote_reference, quote_record.quote_version,
          quote_record.record_version as quote_record_version,
          quote_record.status as quote_status,
          quote_record.request_id, quote_record.source_request_version,
          quote_record.customer_id, quote_record.property_id,
          quote_record.estimate_id, quote_record.currency,
          quote_record.price_basis, quote_record.net_amount_minor_units,
          quote_record.vat_rate_basis_points,
          quote_record.vat_amount_minor_units,
          quote_record.gross_total_minor_units,
          quote_record.estimated_duration_minutes,
          quote_record.commercial_snapshot, quote_record.terms_snapshot,
          quote_record.acceptance_source_snapshot,
          quote_record.customer_notes, quote_record.valid_from,
          quote_record.valid_until, quote_record.issued_at,
          request_record.status as request_status,
          request_record.version as request_version,
          request_record.customer_resolution_status,
          request_record.customer_id as request_customer_id,
          request_record.property_id as request_property_id,
          request_record.preferred_date,
          request_record.preferred_window_code,
          request_record.customer_notes as request_customer_notes
        from ${quotes} quote_record
        join ${serviceRequests} request_record
          on request_record.id = quote_record.request_id
        where quote_record.quote_reference = ${input.quoteReference}
          and ${access}
        for update of quote_record, request_record
      ),
      commercial_context as materialized (
        select customer.id as customer_id,
          customer.display_name as customer_display_name,
          customer.preferred_locale as customer_preferred_locale,
          customer.customer_type, customer.status as customer_status,
          customer.version as customer_version,
          property.id as property_id,
          property.customer_id as property_customer_id,
          property.property_type, property.label as property_label,
          property.city as property_city,
          property.district as property_district,
          property.street_address as property_street_address,
          property.postal_code as property_postal_code,
          property.latitude as property_latitude,
          property.longitude as property_longitude,
          property.access_notes as property_access_notes,
          property.parking_notes as property_parking_notes,
          property.service_zone_id, property.status as property_status,
          property.version as property_version,
          case customer.customer_type
            when 'INDIVIDUAL' then 'RESIDENTIAL'
            when 'BUSINESS' then 'B2B'
          end as customer_segment
        from target
        join ${customers} customer on customer.id = target.customer_id
        join ${properties} property
          on property.id = target.property_id
         and property.customer_id = target.customer_id
        for share of customer, property
      ),
      travel_context as materialized (
        select zone.id as travel_zone_id, zone.code as travel_zone_code,
          zone.active as travel_zone_active,
          zone.default_parking_policy_id,
          zone.distance_threshold_hundredths_km,
          zone.travel_time_threshold_minutes,
          zone.boundary_notes, zone.service_eligible,
          zone.minimum_order_override_minor_units,
          zone.estimated_base_travel_minutes,
          zone.manual_confirmation_required,
          zone.geographic_metadata,
          zone.updated_at as travel_zone_updated_at
        from commercial_context
        join ${travelZones} zone
          on zone.id = commercial_context.service_zone_id
        for share of zone
      ),
      selected_estimate as materialized (
        select estimate.id as estimate_id,
          estimate.request_id as estimate_request_id,
          estimate.source_request_version as estimate_source_request_version,
          estimate.estimate_version, estimate.status as estimate_status,
          estimate.price_book_id, estimate.price_book_code,
          estimate.price_book_version, estimate.duration_model_id,
          estimate.duration_model_code, estimate.duration_model_version,
          estimate.input_snapshot, estimate.price_snapshot,
          estimate.duration_snapshot, estimate.availability_snapshot,
          estimate.net_amount_minor_units as estimate_net_amount_minor_units,
          estimate.vat_rate_basis_points as estimate_vat_rate_basis_points,
          estimate.vat_amount_minor_units as estimate_vat_amount_minor_units,
          estimate.gross_total_minor_units as estimate_gross_total_minor_units,
          estimate.currency as estimate_currency,
          estimate.estimated_service_minutes,
          estimate.estimated_travel_minutes,
          estimate.manual_assessment_required,
          estimate.decline_or_refer_required,
          estimate.warnings, estimate.review_reason_codes,
          estimate.calculated_at
        from target
        join ${requestEstimates} estimate
          on estimate.id = target.estimate_id
         and estimate.request_id = target.request_id
        for share of estimate
      ),
      estimate_evidence_integrity as materialized (
        select 1 as valid
        from selected_estimate
        where ${completeEstimateEvidenceSql({
          inputSnapshot: sql`selected_estimate.input_snapshot`,
          priceSnapshot: sql`selected_estimate.price_snapshot`,
          durationSnapshot: sql`selected_estimate.duration_snapshot`,
          availabilitySnapshot: sql`selected_estimate.availability_snapshot`,
          warnings: sql`selected_estimate.warnings`,
          reviewReasonCodes: sql`selected_estimate.review_reason_codes`,
          status: sql`selected_estimate.estimate_status`,
          priceBookCode: sql`selected_estimate.price_book_code`,
          priceBookVersion: sql`selected_estimate.price_book_version`,
          durationModelCode: sql`selected_estimate.duration_model_code`,
          durationModelVersion: sql`selected_estimate.duration_model_version`,
          netAmountMinorUnits: sql`selected_estimate.estimate_net_amount_minor_units`,
          vatRateBasisPoints: sql`selected_estimate.estimate_vat_rate_basis_points`,
          vatAmountMinorUnits: sql`selected_estimate.estimate_vat_amount_minor_units`,
          grossTotalMinorUnits: sql`selected_estimate.estimate_gross_total_minor_units`,
          currency: sql`selected_estimate.estimate_currency`,
          estimatedServiceMinutes: sql`selected_estimate.estimated_service_minutes`,
          estimatedTravelMinutes: sql`selected_estimate.estimated_travel_minutes`,
          manualAssessmentRequired: sql`selected_estimate.manual_assessment_required`,
          declineOrReferRequired: sql`selected_estimate.decline_or_refer_required`,
          calculatedAt: sql`selected_estimate.calculated_at`,
        })}
      ),
      request_item_source_rows as materialized (
        select request_item.id, request_item.service_id,
          request_item.cleaning_item_type_id, request_item.cleaning_asset_id,
          request_item.measurement_mode_id,
          request_item.customer_reported_condition_level_id,
          request_item.normalized_condition_level_id,
          request_item.reported_fibre_material_id,
          request_item.normalized_fibre_material_id,
          request_item.reported_surface_construction_id,
          request_item.normalized_surface_construction_id,
          request_item.customer_description,
          request_item.normalized_description, request_item.quantity,
          request_item.area_hundredths_m2, request_item.seat_count,
          request_item.sides, request_item.sort_order, request_item.version
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
        for share of request_item
      ),
      request_issue_source_rows as materialized (
        select selected_issue.request_item_id, selected_issue.issue_type_id,
          selected_issue.customer_reported, selected_issue.staff_confirmed,
          selected_issue.notes
        from request_item_source_rows request_item
        join ${serviceRequestItemIssues} selected_issue
          on selected_issue.request_item_id = request_item.id
        for share of selected_issue
      ),
      request_addon_source_rows as materialized (
        select selected_addon.request_item_id, selected_addon.addon_id,
          selected_addon.customer_requested, selected_addon.staff_included,
          selected_addon.notes
        from request_item_source_rows request_item
        join ${serviceRequestItemAddons} selected_addon
          on selected_addon.request_item_id = request_item.id
        for share of selected_addon
      ),
      quote_item_source_rows as materialized (
        select quote_item.id, quote_item.request_item_id,
          quote_item.service_id, quote_item.cleaning_item_type_id,
          quote_item.measurement_mode_id, quote_item.description_bg,
          quote_item.description_en, quote_item.quantity,
          quote_item.measurement_snapshot,
          quote_item.base_amount_minor_units,
          quote_item.modifier_amount_minor_units,
          quote_item.addon_amount_minor_units,
          quote_item.net_amount_minor_units,
          quote_item.vat_rate_basis_points,
          quote_item.vat_amount_minor_units,
          quote_item.gross_total_minor_units,
          quote_item.calculation_snapshot, quote_item.sort_order
        from target
        join ${quoteItems} quote_item
          on quote_item.quote_id = target.quote_id
        for share of quote_item
      ),
      current_source_snapshot as materialized (
        select jsonb_build_object(
          'schemaVersion', 1,
          'quote', jsonb_build_object(
            'id', target.quote_id,
            'quoteReference', target.quote_reference,
            'quoteVersion', target.quote_version,
            'recordVersion', target.quote_record_version,
            'status', target.quote_status,
            'requestId', target.request_id,
            'sourceRequestVersion', target.source_request_version,
            'customerId', target.customer_id,
            'propertyId', target.property_id,
            'estimateId', target.estimate_id,
            'currency', target.currency,
            'priceBasis', target.price_basis,
            'netAmountMinorUnits', target.net_amount_minor_units,
            'vatRateBasisPoints', target.vat_rate_basis_points,
            'vatAmountMinorUnits', target.vat_amount_minor_units,
            'grossTotalMinorUnits', target.gross_total_minor_units,
            'estimatedDurationMinutes', target.estimated_duration_minutes,
            'commercialSnapshot', target.commercial_snapshot,
            'termsSnapshot', target.terms_snapshot,
            'customerNotes', target.customer_notes,
            'validFrom', target.valid_from,
            'validUntil', target.valid_until,
            'issuedAt', target.issued_at
          ),
          'request', jsonb_build_object(
            'id', target.request_id,
            'status', target.request_status,
            'version', target.request_version,
            'sourceRequestVersion', target.source_request_version,
            'customerResolutionStatus', target.customer_resolution_status,
            'customerId', target.request_customer_id,
            'propertyId', target.request_property_id,
            'preferredDate', target.preferred_date,
            'preferredWindowCode', target.preferred_window_code,
            'customerNotes', target.request_customer_notes,
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', request_item.id,
                  'version', request_item.version,
                  'serviceId', request_item.service_id,
                  'cleaningItemTypeId', request_item.cleaning_item_type_id,
                  'cleaningAssetId', request_item.cleaning_asset_id,
                  'measurementModeId', request_item.measurement_mode_id,
                  'customerReportedConditionLevelId',
                    request_item.customer_reported_condition_level_id,
                  'normalizedConditionLevelId',
                    request_item.normalized_condition_level_id,
                  'reportedFibreMaterialId',
                    request_item.reported_fibre_material_id,
                  'normalizedFibreMaterialId',
                    request_item.normalized_fibre_material_id,
                  'reportedSurfaceConstructionId',
                    request_item.reported_surface_construction_id,
                  'normalizedSurfaceConstructionId',
                    request_item.normalized_surface_construction_id,
                  'customerDescription', request_item.customer_description,
                  'normalizedDescription', request_item.normalized_description,
                  'quantity', request_item.quantity,
                  'areaHundredthsM2', request_item.area_hundredths_m2,
                  'seatCount', request_item.seat_count,
                  'sides', request_item.sides,
                  'sortOrder', request_item.sort_order,
                  'issues', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'issueTypeId', selected_issue.issue_type_id,
                        'customerReported', selected_issue.customer_reported,
                        'staffConfirmed', selected_issue.staff_confirmed,
                        'notes', selected_issue.notes
                      ) order by selected_issue.issue_type_id
                    )
                    from request_issue_source_rows selected_issue
                    where selected_issue.request_item_id = request_item.id
                  ), '[]'::jsonb),
                  'addons', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'addonId', selected_addon.addon_id,
                        'customerRequested', selected_addon.customer_requested,
                        'staffIncluded', selected_addon.staff_included,
                        'notes', selected_addon.notes
                      ) order by selected_addon.addon_id
                    )
                    from request_addon_source_rows selected_addon
                    where selected_addon.request_item_id = request_item.id
                  ), '[]'::jsonb)
                ) order by request_item.sort_order, request_item.id
              )
              from request_item_source_rows request_item
            ), '[]'::jsonb)
          ),
          'estimate', jsonb_build_object(
            'id', selected_estimate.estimate_id,
            'requestId', selected_estimate.estimate_request_id,
            'sourceRequestVersion',
              selected_estimate.estimate_source_request_version,
            'estimateVersion', selected_estimate.estimate_version,
            'status', selected_estimate.estimate_status,
            'priceBookId', selected_estimate.price_book_id,
            'priceBookCode', selected_estimate.price_book_code,
            'priceBookVersion', selected_estimate.price_book_version,
            'durationModelId', selected_estimate.duration_model_id,
            'durationModelCode', selected_estimate.duration_model_code,
            'durationModelVersion', selected_estimate.duration_model_version,
            'inputSnapshot', selected_estimate.input_snapshot,
            'priceSnapshot', selected_estimate.price_snapshot,
            'durationSnapshot', selected_estimate.duration_snapshot,
            'availabilitySnapshot', selected_estimate.availability_snapshot,
            'netAmountMinorUnits',
              selected_estimate.estimate_net_amount_minor_units,
            'vatRateBasisPoints',
              selected_estimate.estimate_vat_rate_basis_points,
            'vatAmountMinorUnits',
              selected_estimate.estimate_vat_amount_minor_units,
            'grossTotalMinorUnits',
              selected_estimate.estimate_gross_total_minor_units,
            'currency', selected_estimate.estimate_currency,
            'estimatedServiceMinutes',
              selected_estimate.estimated_service_minutes,
            'estimatedTravelMinutes',
              selected_estimate.estimated_travel_minutes,
            'manualAssessmentRequired',
              selected_estimate.manual_assessment_required,
            'declineOrReferRequired',
              selected_estimate.decline_or_refer_required,
            'warnings', selected_estimate.warnings,
            'reviewReasonCodes', selected_estimate.review_reason_codes,
            'calculatedAt', selected_estimate.calculated_at
          ),
          'customer', jsonb_build_object(
            'id', commercial_context.customer_id,
            'displayName', commercial_context.customer_display_name,
            'preferredLocale', commercial_context.customer_preferred_locale,
            'customerType', commercial_context.customer_type,
            'status', commercial_context.customer_status,
            'version', commercial_context.customer_version
          ),
          'property', jsonb_build_object(
            'id', commercial_context.property_id,
            'customerId', commercial_context.property_customer_id,
            'propertyType', commercial_context.property_type,
            'label', commercial_context.property_label,
            'city', commercial_context.property_city,
            'district', commercial_context.property_district,
            'streetAddress', commercial_context.property_street_address,
            'postalCode', commercial_context.property_postal_code,
            'latitude', commercial_context.property_latitude,
            'longitude', commercial_context.property_longitude,
            'accessNotes', commercial_context.property_access_notes,
            'parkingNotes', commercial_context.property_parking_notes,
            'serviceZoneId', commercial_context.service_zone_id,
            'status', commercial_context.property_status,
            'version', commercial_context.property_version
          ),
          'travelZone', jsonb_build_object(
            'id', travel_context.travel_zone_id,
            'code', travel_context.travel_zone_code,
            'active', travel_context.travel_zone_active,
            'defaultParkingPolicyId',
              travel_context.default_parking_policy_id,
            'distanceThresholdHundredthsKm',
              travel_context.distance_threshold_hundredths_km,
            'travelTimeThresholdMinutes',
              travel_context.travel_time_threshold_minutes,
            'boundaryNotes', travel_context.boundary_notes,
            'serviceEligible', travel_context.service_eligible,
            'minimumOrderOverrideMinorUnits',
              travel_context.minimum_order_override_minor_units,
            'estimatedBaseTravelMinutes',
              travel_context.estimated_base_travel_minutes,
            'manualConfirmationRequired',
              travel_context.manual_confirmation_required,
            'geographicMetadata', travel_context.geographic_metadata,
            'updatedAt', travel_context.travel_zone_updated_at
          ),
          'quoteItems', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', quote_item.id,
                'requestItemId', quote_item.request_item_id,
                'serviceId', quote_item.service_id,
                'cleaningItemTypeId', quote_item.cleaning_item_type_id,
                'measurementModeId', quote_item.measurement_mode_id,
                'descriptionBg', quote_item.description_bg,
                'descriptionEn', quote_item.description_en,
                'quantity', quote_item.quantity,
                'measurementSnapshot', quote_item.measurement_snapshot,
                'baseAmountMinorUnits', quote_item.base_amount_minor_units,
                'modifierAmountMinorUnits',
                  quote_item.modifier_amount_minor_units,
                'addonAmountMinorUnits', quote_item.addon_amount_minor_units,
                'netAmountMinorUnits', quote_item.net_amount_minor_units,
                'vatRateBasisPoints', quote_item.vat_rate_basis_points,
                'vatAmountMinorUnits', quote_item.vat_amount_minor_units,
                'grossTotalMinorUnits', quote_item.gross_total_minor_units,
                'calculationSnapshot', quote_item.calculation_snapshot,
                'sortOrder', quote_item.sort_order
              ) order by quote_item.sort_order, quote_item.id
            )
            from quote_item_source_rows quote_item
          ), '[]'::jsonb)
        ) as value
        from target, commercial_context, travel_context, selected_estimate
      ),
      existing as materialized (
        select booking.booking_reference
        from target
        join ${quoteAcceptances} acceptance
          on acceptance.quote_id = target.quote_id
        join ${bookings} booking
          on booking.quote_acceptance_id = acceptance.id
         and booking.quote_id = target.quote_id
      ),
      quote_line_integrity as materialized (
        select count(line.id)::integer as line_count,
          count(distinct line.request_item_id)::integer as request_item_count,
          coalesce(sum(line.net_amount_minor_units), 0)::integer as net_total,
          coalesce(sum(line.vat_amount_minor_units), 0)::integer as vat_total,
          coalesce(sum(line.gross_total_minor_units), 0)::integer as gross_total,
          coalesce(bool_and(
            line.request_item_id is not null
            and request_item.id is not null
            and line.service_id is not distinct from request_item.service_id
            and line.cleaning_item_type_id is not distinct from request_item.cleaning_item_type_id
            and line.measurement_mode_id is not distinct from request_item.measurement_mode_id
            and line.quantity = request_item.quantity
            and line.measurement_snapshot = jsonb_build_object(
              'areaHundredthsM2', request_item.area_hundredths_m2,
              'seatCount', request_item.seat_count,
              'sides', request_item.sides
            )
            and line.calculation_snapshot -> 'sourceEstimate'
              = target.commercial_snapshot -> 'sourceEstimate'
          ), false) as graph_matches
        from target
        left join quote_item_source_rows line on true
        left join ${serviceRequestItems} request_item
          on request_item.id = line.request_item_id
         and request_item.request_id = target.request_id
      ),
      request_item_integrity as materialized (
        select count(request_item.id)::integer as item_count,
          coalesce(bool_and(exists (
            select 1 from quote_item_source_rows line
            where line.request_item_id = request_item.id
          )), false) as all_quoted
        from target
        left join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
      ),
      integrity as materialized (
        select target.*,
          commercial_context.customer_status,
          commercial_context.property_status,
          commercial_context.customer_segment as current_customer_segment,
          travel_context.travel_zone_code,
          travel_context.travel_zone_active,
          selected_estimate.estimate_source_request_version,
          selected_estimate.estimate_version,
          selected_estimate.estimate_status,
          selected_estimate.price_book_code,
          selected_estimate.price_book_version,
          selected_estimate.duration_model_code,
          selected_estimate.duration_model_version,
          selected_estimate.input_snapshot,
          selected_estimate.price_snapshot,
          selected_estimate.duration_snapshot,
          selected_estimate.estimate_net_amount_minor_units,
          selected_estimate.estimate_vat_rate_basis_points,
          selected_estimate.estimate_vat_amount_minor_units,
          selected_estimate.estimate_gross_total_minor_units,
          selected_estimate.estimate_currency,
          selected_estimate.estimated_service_minutes,
          selected_estimate.decline_or_refer_required,
          current_source_snapshot.value as current_acceptance_source_snapshot,
          quote_line_integrity.line_count,
          quote_line_integrity.request_item_count as quoted_request_item_count,
          request_item_integrity.item_count,
          quote_line_integrity.net_total,
          quote_line_integrity.vat_total,
          quote_line_integrity.gross_total,
          quote_line_integrity.graph_matches,
          request_item_integrity.all_quoted
        from target, commercial_context, travel_context, selected_estimate,
          current_source_snapshot, quote_line_integrity,
          request_item_integrity
      ),
      decision as materialized (
        select case
          when exists (select 1 from existing) then 'EXISTING'
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when (select quote_version from integrity) <> ${input.expectedQuoteVersion}
            then 'REFERENCE_CONFLICT'
          when (select quote_status from integrity) <> 'ISSUED'
            or (select issued_at from integrity) is null
            or now() < (select valid_from from integrity)
            or now() >= (select valid_until from integrity)
            then 'REVIEW_REQUIRED'
          when (select request_status from integrity) <> 'QUOTED'
            or (select customer_resolution_status from integrity) <> 'LINKED'
            or (select request_version from integrity)
              <> (select source_request_version + 1 from integrity)
            or (select request_customer_id from integrity)
              is distinct from (select customer_id from integrity)
            or (select request_property_id from integrity)
              is distinct from (select property_id from integrity)
            then 'REVIEW_REQUIRED'
          when not exists (select 1 from current_source_snapshot)
            or not exists (select 1 from estimate_evidence_integrity)
            or (select acceptance_source_snapshot from target) is null
            or (select acceptance_source_snapshot from target)
              is distinct from (
                select current_acceptance_source_snapshot from integrity
              )
            then 'REVIEW_REQUIRED'
          when (select property_id from integrity) is null
            or (select customer_status from integrity) <> 'ACTIVE'
            or (select property_status from integrity) <> 'ACTIVE'
            or not (select travel_zone_active from integrity)
            or (select current_customer_segment from integrity) is null
            or (select travel_zone_code from integrity) not in (
              'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
            )
            or (select current_customer_segment from integrity)
              is distinct from (select input_snapshot ->> 'customerSegment' from integrity)
            or (select travel_zone_code from integrity)
              is distinct from (select input_snapshot ->> 'travelZoneCode' from integrity)
            then 'REVIEW_REQUIRED'
          when (select estimate_source_request_version from integrity)
              <> (select source_request_version from integrity)
            or (select decline_or_refer_required from integrity)
            or (select estimate_status from integrity) = 'DECLINE_OR_REFER'
            or (select commercial_snapshot #>> '{sourceEstimate,estimateId}' from integrity)
              is distinct from (select estimate_id::text from integrity)
            or (select commercial_snapshot #>> '{sourceEstimate,estimateVersion}' from integrity)
              is distinct from (select estimate_version::text from integrity)
            or (select commercial_snapshot #>> '{sourceEstimate,sourceRequestVersion}' from integrity)
              is distinct from (select source_request_version::text from integrity)
            or (select commercial_snapshot #>> '{sourceEstimate,priceBook,code}' from integrity)
              is distinct from (select price_book_code from integrity)
            or (select commercial_snapshot #>> '{sourceEstimate,priceBook,version}' from integrity)
              is distinct from (select price_book_version::text from integrity)
            or coalesce((select commercial_snapshot #>> '{sourceEstimate,priceSnapshotSha256}' from integrity), '')
              !~ '^[a-f0-9]{64}$'
            or (select commercial_snapshot
                  #>> '{sourceEstimate,priceSnapshotSha256}' from integrity)
              is distinct from (
                select ${priceSnapshotSha256Sql(sql`price_snapshot`)}
                from integrity
              )
            then 'REVIEW_REQUIRED'
          when (select price_snapshot #>> '{priceBook,code}' from integrity)
              is distinct from (select price_book_code from integrity)
            or (select price_snapshot #>> '{priceBook,version}' from integrity)
              is distinct from (select price_book_version::text from integrity)
            or (select price_snapshot #>> '{result,netAmountMinorUnits}' from integrity)
              is distinct from (select estimate_net_amount_minor_units::text from integrity)
            or (select price_snapshot #>> '{result,vatRateBasisPoints}' from integrity)
              is distinct from (select estimate_vat_rate_basis_points::text from integrity)
            or (select price_snapshot #>> '{result,vatAmountMinorUnits}' from integrity)
              is distinct from (select estimate_vat_amount_minor_units::text from integrity)
            or (select price_snapshot #>> '{result,grossTotalMinorUnits}' from integrity)
              is distinct from (select estimate_gross_total_minor_units::text from integrity)
            or (select price_snapshot #>> '{result,currency}' from integrity)
              is distinct from (select estimate_currency from integrity)
            or (select duration_snapshot #>> '{durationModel,code}' from integrity)
              is distinct from (select duration_model_code from integrity)
            or (select duration_snapshot #>> '{durationModel,version}' from integrity)
              is distinct from (select duration_model_version::text from integrity)
            or (select duration_snapshot #>> '{result,totalEstimatedMinutes}' from integrity)
              is distinct from (select estimated_service_minutes::text from integrity)
            then 'REVIEW_REQUIRED'
          when (select line_count from integrity) <= 0
            or (select line_count from integrity) <> (select item_count from integrity)
            or (select quoted_request_item_count from integrity) <> (select item_count from integrity)
            or not (select graph_matches from integrity)
            or not (select all_quoted from integrity)
            or (select net_total from integrity) <> (select net_amount_minor_units from integrity)
            or (select vat_total from integrity) <> (select vat_amount_minor_units from integrity)
            or (select gross_total from integrity) <> (select gross_total_minor_units from integrity)
            then 'REVIEW_REQUIRED'
          else 'READY'
        end as result,
        case
          when exists (select 1 from target)
            and not exists (select 1 from existing)
          then jsonb_build_array(
            case when (select quote_status from target) <> 'ISSUED'
              or now() < (select valid_from from target)
              or now() >= (select valid_until from target)
              then 'QUOTE_NOT_ELIGIBLE' end,
            case when (select request_status from target) <> 'QUOTED'
              or (select request_version from target) <> (select source_request_version + 1 from target)
              then 'REQUEST_PROVENANCE_STALE' end,
            'ACCEPTANCE_INTEGRITY_REVIEW_REQUIRED'
          )
          else '[]'::jsonb
        end as reason_codes
      ),
      accepted as (
        insert into ${quoteAcceptances} (
          quote_id, quote_version, quote_record_version, request_id,
          source_request_version, customer_id, property_id,
          accepted_by_profile_id, actor_type, acceptance_source,
          acceptance_note, commercial_snapshot, terms_snapshot,
          pricing_snapshot, duration_snapshot, provenance_snapshot,
          safe_metadata
        )
        select integrity.quote_id, integrity.quote_version,
          integrity.quote_record_version, integrity.request_id,
          integrity.source_request_version, integrity.customer_id,
          integrity.property_id, ${actorProfileId}::uuid, ${input.actorType},
          ${input.acceptanceSource}, ${input.acceptanceNote},
          integrity.acceptance_source_snapshot #> '{quote,commercialSnapshot}',
          integrity.acceptance_source_snapshot #> '{quote,termsSnapshot}',
          jsonb_build_object(
            'schemaVersion', 1,
            'currency',
              integrity.acceptance_source_snapshot #> '{quote,currency}',
            'priceBasis',
              integrity.acceptance_source_snapshot #> '{quote,priceBasis}',
            'netAmountMinorUnits',
              integrity.acceptance_source_snapshot
                #> '{quote,netAmountMinorUnits}',
            'vatRateBasisPoints',
              integrity.acceptance_source_snapshot
                #> '{quote,vatRateBasisPoints}',
            'vatAmountMinorUnits',
              integrity.acceptance_source_snapshot
                #> '{quote,vatAmountMinorUnits}',
            'grossTotalMinorUnits',
              integrity.acceptance_source_snapshot
                #> '{quote,grossTotalMinorUnits}',
            'sourceEstimatePriceSnapshot',
              integrity.acceptance_source_snapshot
                #> '{estimate,priceSnapshot}'
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'quotedDurationMinutes',
              integrity.acceptance_source_snapshot
                #> '{quote,estimatedDurationMinutes}',
            'sourceEstimateDurationSnapshot',
              integrity.acceptance_source_snapshot
                #> '{estimate,durationSnapshot}'
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'quoteVersion', integrity.acceptance_source_snapshot
              #> '{quote,quoteVersion}',
            'quoteRecordVersion', integrity.acceptance_source_snapshot
              #> '{quote,recordVersion}',
            'sourceRequestVersion', integrity.acceptance_source_snapshot
              #> '{quote,sourceRequestVersion}',
            'issuedRequestVersion', integrity.acceptance_source_snapshot
              #> '{request,version}',
            'estimateId', integrity.acceptance_source_snapshot
              #> '{estimate,id}',
            'estimateVersion', integrity.acceptance_source_snapshot
              #> '{estimate,estimateVersion}',
            'customerSegment', integrity.acceptance_source_snapshot
              #> '{estimate,inputSnapshot,customerSegment}',
            'travelZoneCode', integrity.acceptance_source_snapshot
              #> '{travelZone,code}',
            'quoteItemCount', integrity.line_count,
            'quoteSourceSnapshotMatched', true,
            'requestSourceSnapshotMatched', true,
            'requestNormalizationPreserved', true
          ),
          jsonb_build_object('exactScheduleConfirmed', false)
        from integrity, decision
        where decision.result = 'READY'
        returning *
      ),
      created_booking as (
        insert into ${bookings} (
          booking_reference, request_id, quote_id, quote_acceptance_id,
          customer_id, property_id, status, scheduling_status,
          preferred_date, appointment_window_code, price_snapshot,
          duration_snapshot, scheduling_snapshot, customer_snapshot,
          property_snapshot, customer_notes_snapshot,
          created_by_profile_id, updated_by_profile_id
        )
        select ${input.bookingReference}, accepted.request_id,
          accepted.quote_id, accepted.id, accepted.customer_id,
          accepted.property_id, 'PENDING_SCHEDULING', 'REVIEW_REQUIRED',
          (integrity.acceptance_source_snapshot
            #>> '{request,preferredDate}')::date,
          integrity.acceptance_source_snapshot
            #>> '{request,preferredWindowCode}',
          accepted.pricing_snapshot, accepted.duration_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'status', 'REVIEW_REQUIRED',
            'exactSlotConfirmed', false,
            'reasonCodes', jsonb_build_array(
              'OPERATIONAL_REQUIREMENTS_NOT_FROZEN',
              'SCHEDULING_CONFIGURATION_UNAPPROVED'
            ),
            'commercialTermsPreserved', true
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'displayName', integrity.acceptance_source_snapshot
              #> '{customer,displayName}',
            'preferredLocale', integrity.acceptance_source_snapshot
              #> '{customer,preferredLocale}',
            'customerType', integrity.acceptance_source_snapshot
              #> '{customer,customerType}',
            'version', integrity.acceptance_source_snapshot
              #> '{customer,version}'
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'label', integrity.acceptance_source_snapshot
              #> '{property,label}',
            'city', integrity.acceptance_source_snapshot #> '{property,city}',
            'district', integrity.acceptance_source_snapshot
              #> '{property,district}',
            'streetAddress', integrity.acceptance_source_snapshot
              #> '{property,streetAddress}',
            'postalCode', integrity.acceptance_source_snapshot
              #> '{property,postalCode}',
            'accessNotes', integrity.acceptance_source_snapshot
              #> '{property,accessNotes}',
            'parkingNotes', integrity.acceptance_source_snapshot
              #> '{property,parkingNotes}',
            'latitude', integrity.acceptance_source_snapshot
              #> '{property,latitude}',
            'longitude', integrity.acceptance_source_snapshot
              #> '{property,longitude}',
            'travelZoneCode', integrity.acceptance_source_snapshot
              #> '{travelZone,code}',
            'version', integrity.acceptance_source_snapshot
              #> '{property,version}'
          ),
          integrity.acceptance_source_snapshot #>> '{quote,customerNotes}',
          ${actorProfileId}::uuid,
          ${actorProfileId}::uuid
        from accepted, integrity
        returning *
      ),
      copied_items as (
        insert into ${bookingItems} (
          booking_id, quote_item_id, request_item_id, service_id,
          cleaning_item_type_id, measurement_mode_id, description_bg,
          description_en, quantity, measurement_snapshot,
          base_amount_minor_units, modifier_amount_minor_units,
          addon_amount_minor_units, net_amount_minor_units,
          vat_rate_basis_points, vat_amount_minor_units,
          gross_total_minor_units, calculation_snapshot,
          duration_basis_snapshot, sort_order
        )
        select created_booking.id, line.id, line."requestItemId",
          line."serviceId", line."cleaningItemTypeId",
          line."measurementModeId", line."descriptionBg",
          line."descriptionEn", line.quantity, line."measurementSnapshot",
          line."baseAmountMinorUnits", line."modifierAmountMinorUnits",
          line."addonAmountMinorUnits", line."netAmountMinorUnits",
          line."vatRateBasisPoints", line."vatAmountMinorUnits",
          line."grossTotalMinorUnits", line."calculationSnapshot",
          created_booking.duration_snapshot, line."sortOrder"
        from created_booking, integrity
        cross join lateral jsonb_to_recordset(
          integrity.acceptance_source_snapshot -> 'quoteItems'
        ) as line(
          id uuid,
          "requestItemId" uuid,
          "serviceId" integer,
          "cleaningItemTypeId" integer,
          "measurementModeId" integer,
          "descriptionBg" text,
          "descriptionEn" text,
          quantity integer,
          "measurementSnapshot" jsonb,
          "baseAmountMinorUnits" integer,
          "modifierAmountMinorUnits" integer,
          "addonAmountMinorUnits" integer,
          "netAmountMinorUnits" integer,
          "vatRateBasisPoints" integer,
          "vatAmountMinorUnits" integer,
          "grossTotalMinorUnits" integer,
          "calculationSnapshot" jsonb,
          "sortOrder" integer
        )
        returning id
      ),
      audited as (
        insert into ${bookingAuditEvents} (
          booking_id, quote_acceptance_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select created_booking.id, created_booking.quote_acceptance_id,
          event.event_type, ${actorProfileId}::uuid,
          case when ${input.actorType} = 'CUSTOMER'
            then 'CUSTOMER_PORTAL' else 'STAFF' end,
          jsonb_build_object(
            'actorType', ${input.actorType},
            'quoteVersion', integrity.quote_version,
            'schedulingStatus', 'REVIEW_REQUIRED'
          )
        from created_booking, integrity
        cross join (values ('QUOTE_ACCEPTED'), ('BOOKING_CREATED'))
          as event(event_type)
        returning id
      )
      select case
          when decision.result = 'READY' and created_booking.id is not null
            and (select count(*) from copied_items) = (select line_count from integrity)
            and (select count(*) from audited) = 2
          then 'CREATED'
          else decision.result
        end::text as result,
        coalesce(
          created_booking.booking_reference,
          (select booking_reference from existing)
        ) as "bookingReference",
        decision.reason_codes as "reasonCodes"
      from decision
      left join created_booking on true
    `);
    return acceptanceResult(result.rows[0]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await loadExistingAcceptanceRecord(
      database,
      actorProfileId,
      input,
    );
    return existing ?? { status: "REFERENCE_CONFLICT" };
  }
}

export async function previewCustomerQuoteAcceptanceRecord(
  database: Database,
  actorProfileId: string,
  quoteReference: string,
): Promise<QuoteAcceptancePreview | null> {
  const result = await database.execute<{
    state: QuoteAcceptancePreview["state"];
    bookingReference: string | null;
  }>(sql`
    select case
        when booking.id is not null then 'EXISTING'
        when quote_record.status = 'ISSUED'
          and quote_record.issued_at is not null
          and quote_record.acceptance_source_snapshot is not null
          and quote_record.acceptance_source_snapshot ->> 'schemaVersion' = '1'
          and now() >= quote_record.valid_from
          and now() < quote_record.valid_until
          and request_record.status = 'QUOTED'
          and request_record.version = quote_record.source_request_version + 1
          and request_record.customer_resolution_status = 'LINKED'
          and request_record.customer_id = quote_record.customer_id
          and request_record.property_id = quote_record.property_id
        then 'ELIGIBLE'
        else 'REVIEW_REQUIRED'
      end::text as state,
      booking.booking_reference as "bookingReference"
    from ${quotes} quote_record
    join ${serviceRequests} request_record
      on request_record.id = quote_record.request_id
    left join ${quoteAcceptances} acceptance
      on acceptance.quote_id = quote_record.id
    left join ${bookings} booking
      on booking.quote_acceptance_id = acceptance.id
    where quote_record.quote_reference = ${quoteReference}
      and ${customerAccessSql(
        actorProfileId,
        sql`quote_record.customer_id`,
        "OWN_CUSTOMER_DATA_READ",
      )}
    limit 1
  `);
  return result.rows[0] ?? null;
}

type CustomerSummaryRow = CustomerBookingSummary;

export async function listCustomerBookingRecords(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerBookingSummary[]> {
  const result = await database.execute<CustomerSummaryRow>(sql`
    select booking.booking_reference as "bookingReference",
      quote_record.quote_reference as "quoteReference",
      booking.status, booking.scheduling_status as "schedulingStatus",
      booking.property_snapshot ->> 'label' as "propertyLabel",
      (booking.price_snapshot ->> 'grossTotalMinorUnits')::integer
        as "grossTotalMinorUnits",
      booking.price_snapshot ->> 'currency' as currency,
      booking.preferred_date::text as "preferredDate",
      booking.appointment_window_code as "appointmentWindowCode",
      booking.scheduled_start as "scheduledStart",
      booking.scheduled_end as "scheduledEnd",
      booking.created_at as "createdAt"
    from ${bookings} booking
    join ${quotes} quote_record on quote_record.id = booking.quote_id
    where ${customerAccessSql(
      actorProfileId,
      sql`booking.customer_id`,
      "OWN_CUSTOMER_DATA_READ",
    )}
    order by booking.created_at desc, booking.booking_reference
  `);
  return result.rows;
}

export async function loadCustomerBookingRecord(
  database: Database,
  actorProfileId: string,
  bookingReference: string,
): Promise<CustomerBookingDetail | null> {
  const result = await database.execute<CustomerBookingDetail>(sql`
    select booking.booking_reference as "bookingReference",
      quote_record.quote_reference as "quoteReference",
      booking.status, booking.scheduling_status as "schedulingStatus",
      booking.customer_snapshot ->> 'displayName' as "customerDisplayName",
      booking.property_snapshot ->> 'label' as "propertyLabel",
      booking.property_snapshot ->> 'streetAddress' as "propertyAddress",
      (booking.price_snapshot ->> 'netAmountMinorUnits')::integer
        as "netAmountMinorUnits",
      (booking.price_snapshot ->> 'vatRateBasisPoints')::integer
        as "vatRateBasisPoints",
      (booking.price_snapshot ->> 'vatAmountMinorUnits')::integer
        as "vatAmountMinorUnits",
      (booking.price_snapshot ->> 'grossTotalMinorUnits')::integer
        as "grossTotalMinorUnits",
      booking.price_snapshot ->> 'currency' as currency,
      (booking.duration_snapshot ->> 'quotedDurationMinutes')::integer
        as "estimatedDurationMinutes",
      acceptance.terms_snapshot as "termsSnapshot",
      booking.customer_notes_snapshot as "customerNotes",
      booking.preferred_date::text as "preferredDate",
      booking.appointment_window_code as "appointmentWindowCode",
      booking.scheduled_start as "scheduledStart",
      booking.scheduled_end as "scheduledEnd",
      booking.created_at as "createdAt",
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'descriptionBg', item.description_bg,
          'descriptionEn', item.description_en,
          'quantity', item.quantity,
          'measurementSnapshot', item.measurement_snapshot,
          'netAmountMinorUnits', item.net_amount_minor_units,
          'vatRateBasisPoints', item.vat_rate_basis_points,
          'vatAmountMinorUnits', item.vat_amount_minor_units,
          'grossTotalMinorUnits', item.gross_total_minor_units,
          'sortOrder', item.sort_order
        ) order by item.sort_order)
        from ${bookingItems} item
        where item.booking_id = booking.id
      ), '[]'::jsonb) as items
    from ${bookings} booking
    join ${quotes} quote_record on quote_record.id = booking.quote_id
    join ${quoteAcceptances} acceptance
      on acceptance.id = booking.quote_acceptance_id
    where booking.booking_reference = ${bookingReference}
      and ${customerAccessSql(
        actorProfileId,
        sql`booking.customer_id`,
        "OWN_CUSTOMER_DATA_READ",
      )}
    limit 1
  `);
  return result.rows[0] ?? null;
}

type StaffSummaryRow = StaffBookingSummary & { total: number | string };

function staffSummary(row: StaffSummaryRow): StaffBookingSummary {
  return {
    bookingReference: row.bookingReference,
    quoteReference: row.quoteReference,
    status: row.status,
    schedulingStatus: row.schedulingStatus,
    propertyLabel: row.propertyLabel,
    grossTotalMinorUnits: row.grossTotalMinorUnits,
    currency: row.currency,
    preferredDate: row.preferredDate,
    appointmentWindowCode: row.appointmentWindowCode,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    createdAt: row.createdAt,
    customerDisplayName: row.customerDisplayName,
    assignedTeamName: row.assignedTeamName,
    manualReviewRequired: row.manualReviewRequired,
    version: row.version,
  };
}

export async function listStaffBookingRecords(
  database: Database,
  actorProfileId: string,
  input: StaffBookingListInput,
): Promise<StaffBookingPage> {
  const filters: SQL[] = [staffReadSql(actorProfileId)];
  if (input.search) {
    const pattern = `%${input.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    filters.push(sql`(
      booking.booking_reference ilike ${pattern} escape '\\'
      or booking.customer_snapshot ->> 'displayName' ilike ${pattern} escape '\\'
    )`);
  }
  if (input.status) filters.push(sql`booking.status = ${input.status}`);
  if (input.schedulingStatus) {
    filters.push(sql`booking.scheduling_status = ${input.schedulingStatus}`);
  }
  if (input.scheduledFrom) {
    filters.push(sql`booking.scheduled_start >= ${input.scheduledFrom}`);
  }
  if (input.scheduledTo) {
    filters.push(sql`booking.scheduled_start < ${input.scheduledTo}`);
  }

  const result = await database.execute<StaffSummaryRow>(sql`
    select booking.booking_reference as "bookingReference",
      quote_record.quote_reference as "quoteReference",
      booking.status, booking.scheduling_status as "schedulingStatus",
      booking.customer_snapshot ->> 'displayName' as "customerDisplayName",
      booking.property_snapshot ->> 'label' as "propertyLabel",
      (booking.price_snapshot ->> 'grossTotalMinorUnits')::integer
        as "grossTotalMinorUnits",
      booking.price_snapshot ->> 'currency' as currency,
      booking.preferred_date::text as "preferredDate",
      booking.appointment_window_code as "appointmentWindowCode",
      booking.scheduled_start as "scheduledStart",
      booking.scheduled_end as "scheduledEnd",
      team.name as "assignedTeamName",
      (booking.scheduling_status = 'REVIEW_REQUIRED') as "manualReviewRequired",
      booking.version,
      booking.created_at as "createdAt",
      count(*) over() as total
    from ${bookings} booking
    join ${quotes} quote_record on quote_record.id = booking.quote_id
    left join ${operationsTeams} team on team.id = booking.assigned_team_id
    where ${and(...filters)}
    order by booking.created_at desc, booking.booking_reference
    limit ${input.limit} offset ${input.offset}
  `);
  return {
    items: result.rows.map(staffSummary),
    total: Number(result.rows[0]?.total ?? 0),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function loadStaffBookingRecord(
  database: Database,
  actorProfileId: string,
  bookingReference: string,
): Promise<StaffBookingDetail | null> {
  const result = await database.execute<StaffBookingDetail>(sql`
    select booking.booking_reference as "bookingReference",
      quote_record.quote_reference as "quoteReference",
      booking.status, booking.scheduling_status as "schedulingStatus",
      booking.customer_snapshot ->> 'displayName' as "customerDisplayName",
      booking.property_snapshot ->> 'label' as "propertyLabel",
      booking.property_snapshot ->> 'streetAddress' as "propertyAddress",
      (booking.price_snapshot ->> 'netAmountMinorUnits')::integer
        as "netAmountMinorUnits",
      (booking.price_snapshot ->> 'vatRateBasisPoints')::integer
        as "vatRateBasisPoints",
      (booking.price_snapshot ->> 'vatAmountMinorUnits')::integer
        as "vatAmountMinorUnits",
      (booking.price_snapshot ->> 'grossTotalMinorUnits')::integer
        as "grossTotalMinorUnits",
      booking.price_snapshot ->> 'currency' as currency,
      (booking.duration_snapshot ->> 'quotedDurationMinutes')::integer
        as "estimatedDurationMinutes",
      acceptance.actor_type as "acceptanceActorType",
      acceptance.acceptance_source as "acceptanceSource",
      acceptance.acceptance_note as "acceptanceNote",
      acceptance.accepted_at as "acceptedAt",
      acceptance.commercial_snapshot as "commercialSnapshot",
      acceptance.terms_snapshot as "termsSnapshot",
      booking.duration_snapshot as "durationSnapshot",
      booking.scheduling_snapshot as "schedulingSnapshot",
      booking.customer_notes_snapshot as "customerNotes",
      booking.internal_notes as "internalNotes",
      booking.preferred_date::text as "preferredDate",
      booking.appointment_window_code as "appointmentWindowCode",
      booking.scheduled_start as "scheduledStart",
      booking.scheduled_end as "scheduledEnd",
      team.name as "assignedTeamName",
      (booking.scheduling_status = 'REVIEW_REQUIRED') as "manualReviewRequired",
      booking.version, booking.created_at as "createdAt",
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'descriptionBg', item.description_bg,
          'descriptionEn', item.description_en,
          'quantity', item.quantity,
          'measurementSnapshot', item.measurement_snapshot,
          'netAmountMinorUnits', item.net_amount_minor_units,
          'vatRateBasisPoints', item.vat_rate_basis_points,
          'vatAmountMinorUnits', item.vat_amount_minor_units,
          'grossTotalMinorUnits', item.gross_total_minor_units,
          'sortOrder', item.sort_order
        ) order by item.sort_order)
        from ${bookingItems} item
        where item.booking_id = booking.id
      ), '[]'::jsonb) as items,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventType', audit.event_type,
          'source', audit.source,
          'safeMetadata', audit.safe_metadata,
          'createdAt', audit.created_at
        ) order by audit.created_at, audit.id)
        from ${bookingAuditEvents} audit
        where audit.booking_id = booking.id
      ), '[]'::jsonb) as "auditTimeline"
    from ${bookings} booking
    join ${quotes} quote_record on quote_record.id = booking.quote_id
    join ${quoteAcceptances} acceptance
      on acceptance.id = booking.quote_acceptance_id
    left join ${operationsTeams} team on team.id = booking.assigned_team_id
    where booking.booking_reference = ${bookingReference}
      and ${staffReadSql(actorProfileId)}
    limit 1
  `);
  return result.rows[0] ?? null;
}

export async function cancelBookingRecord(
  database: Database,
  actorProfileId: string,
  input: Readonly<{
    bookingReference: string;
    expectedVersion: number;
    reasonCategory: CancellationReasonCategory;
    reasonText: string | null;
  }>,
): Promise<CancellationRepositoryResult> {
  const result = await database.execute<{
    result: CancellationRepositoryResult["status"];
    bookingReference: string | null;
  }>(sql`
    with target as materialized (
      select booking.id, booking.booking_reference, booking.status,
        booking.version, booking.quote_acceptance_id
      from ${bookings} booking
      where booking.booking_reference = ${input.bookingReference}
        and ${staffScheduleSql(actorProfileId)}
      for update of booking
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select status from target) = 'CANCELLED' then 'NO_CHANGE'
        when (select version from target) <> ${input.expectedVersion} then 'CONFLICT'
        when (select status from target) not in ('PENDING_SCHEDULING', 'CONFIRMED')
          then 'INVALID_TRANSITION'
        when exists (select 1 from ${jobs} job
          where job.booking_id = (select id from target)
            and job.status <> 'CANCELLED') then 'INVALID_TRANSITION'
        else 'READY'
      end as result
    ),
    cancelled_occupancy as (
      update ${bookingOccupancies} occupancy
      set status = 'CANCELLED', cancelled_at = now(),
        cancelled_by_profile_id = ${actorProfileId}::uuid
      from target, decision
      where occupancy.booking_id = target.id
        and occupancy.status in ('PENDING', 'CONFIRMED')
        and decision.result = 'READY'
      returning occupancy.id
    ),
    changed as (
      update ${bookings} booking
      set status = 'CANCELLED', cancelled_at = now(),
        cancelled_by_profile_id = ${actorProfileId}::uuid,
        cancellation_reason_category = ${input.reasonCategory},
        cancellation_reason_text = ${input.reasonText},
        version = booking.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from target, decision
      where booking.id = target.id and decision.result = 'READY'
        and (select count(*) from cancelled_occupancy) >= 0
      returning booking.*
    ),
    audited as (
      insert into ${bookingAuditEvents} (
        booking_id, quote_acceptance_id, event_type,
        actor_profile_id, source, safe_metadata
      )
      select changed.id, changed.quote_acceptance_id, 'BOOKING_CANCELLED',
        ${actorProfileId}::uuid, 'STAFF', jsonb_build_object(
          'reasonCategory', ${input.reasonCategory},
          'releasedOccupancyCount', (select count(*) from cancelled_occupancy)
        )
      from changed
      returning id
    )
    select case when decision.result = 'READY' and changed.id is not null
          and (select count(*) from audited) = 1
        then 'CANCELLED' else decision.result end::text as result,
      coalesce(changed.booking_reference, target.booking_reference)
        as "bookingReference"
    from decision
    left join target on true
    left join changed on true
  `);
  const row = result.rows[0];
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if ((row.result === "CANCELLED" || row.result === "NO_CHANGE") && row.bookingReference) {
    return { status: row.result, bookingReference: row.bookingReference };
  }
  return { status: row.result as "CONFLICT" | "INVALID_TRANSITION" };
}

export async function listBookingOccupancyRecords(
  database: Database,
  workDate: string,
  teamCode: "TEAM_A" | "TEAM_B",
): Promise<readonly BookingOccupancyBlock[]> {
  const result = await database.execute<BookingOccupancyBlock>(sql`
    select occupancy.id, team.code as "teamCode",
      to_char(occupancy.service_start at time zone 'Europe/Sofia', 'YYYY-MM-DD')
        as "workDate",
      (extract(hour from occupancy.service_start at time zone 'Europe/Sofia') * 60
        + extract(minute from occupancy.service_start at time zone 'Europe/Sofia'))::integer
        as "serviceStartMinute",
      (extract(hour from occupancy.service_end at time zone 'Europe/Sofia') * 60
        + extract(minute from occupancy.service_end at time zone 'Europe/Sofia'))::integer
        as "serviceEndMinute",
      (extract(hour from occupancy.operational_start at time zone 'Europe/Sofia') * 60
        + extract(minute from occupancy.operational_start at time zone 'Europe/Sofia'))::integer
        as "operationalStartMinute",
      (extract(hour from occupancy.operational_end at time zone 'Europe/Sofia') * 60
        + extract(minute from occupancy.operational_end at time zone 'Europe/Sofia'))::integer
        as "operationalEndMinute",
      occupancy.status, occupancy.location_snapshot as "locationSnapshot",
      occupancy.service_duration_minutes as "serviceDurationMinutes",
      occupancy.travel_snapshot as "travelSnapshot",
      occupancy.scheduling_policy_code as "schedulingPolicyCode",
      occupancy.scheduling_policy_version as "schedulingPolicyVersion",
      occupancy.working_hour_policy_code as "workingHourPolicyCode",
      occupancy.working_hour_policy_version as "workingHourPolicyVersion",
      occupancy.travel_time_profile_code as "travelTimeProfileCode",
      occupancy.travel_time_profile_version as "travelTimeProfileVersion",
      occupancy.snapshot_version as "snapshotVersion",
      (working_policy.id is not null and travel_profile.id is not null)
        as "configurationReferencesMatch"
    from ${bookingOccupancies} occupancy
    join ${operationsTeams} team on team.id = occupancy.team_id
    left join ${workingHourPolicies} working_policy
      on working_policy.id = occupancy.working_hour_policy_id
     and working_policy.code = occupancy.working_hour_policy_code
     and working_policy.version = occupancy.working_hour_policy_version
    left join ${travelTimeProfiles} travel_profile
      on travel_profile.id = occupancy.travel_time_profile_id
     and travel_profile.code = occupancy.travel_time_profile_code
     and travel_profile.version = occupancy.travel_time_profile_version
    where occupancy.status in ('PENDING', 'CONFIRMED')
      and occupancy.operational_start
        < ((${workDate}::date + interval '1 day')::timestamp
          at time zone 'Europe/Sofia')
      and occupancy.operational_end
        > (${workDate}::date::timestamp at time zone 'Europe/Sofia')
      and team.code = ${teamCode}
    order by occupancy.operational_start, occupancy.id
  `);
  return result.rows;
}

export interface BookingRepository {
  previewCustomerAcceptance(
    actorProfileId: string,
    quoteReference: string,
  ): Promise<QuoteAcceptancePreview | null>;
  acceptQuote(
    actorProfileId: string,
    input: AcceptanceRepositoryInput,
  ): Promise<AcceptanceRepositoryResult>;
  listCustomerBookings(
    actorProfileId: string,
  ): Promise<readonly CustomerBookingSummary[]>;
  getCustomerBooking(
    actorProfileId: string,
    bookingReference: string,
  ): Promise<CustomerBookingDetail | null>;
  listStaffBookings(
    actorProfileId: string,
    input: StaffBookingListInput,
  ): Promise<StaffBookingPage>;
  getStaffBooking(
    actorProfileId: string,
    bookingReference: string,
  ): Promise<StaffBookingDetail | null>;
  cancelBooking(
    actorProfileId: string,
    input: Readonly<{
      bookingReference: string;
      expectedVersion: number;
      reasonCategory: CancellationReasonCategory;
      reasonText: string | null;
    }>,
  ): Promise<CancellationRepositoryResult>;
}

export function createDatabaseBookingRepository(
  database: Database,
): BookingRepository {
  return {
    previewCustomerAcceptance: (actorProfileId, quoteReference) =>
      previewCustomerQuoteAcceptanceRecord(
        database,
        actorProfileId,
        quoteReference,
      ),
    acceptQuote: (actorProfileId, input) =>
      acceptQuoteRecord(database, actorProfileId, input),
    listCustomerBookings: (actorProfileId) =>
      listCustomerBookingRecords(database, actorProfileId),
    getCustomerBooking: (actorProfileId, bookingReference) =>
      loadCustomerBookingRecord(database, actorProfileId, bookingReference),
    listStaffBookings: (actorProfileId, input) =>
      listStaffBookingRecords(database, actorProfileId, input),
    getStaffBooking: (actorProfileId, bookingReference) =>
      loadStaffBookingRecord(database, actorProfileId, bookingReference),
    cancelBooking: (actorProfileId, input) =>
      cancelBookingRecord(database, actorProfileId, input),
  };
}
