import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  RequestQuoteAuthorizationError,
  requireCustomerRequestRead,
  requireCustomerRequestUpdate,
  requireStaffRequestManagement,
  requireStaffRequestRead,
  type RequestQuoteActor,
} from "@/modules/request-quote/policy";
import { createDatabaseRequestQuoteRepository } from "@/modules/request-quote/repository";
import {
  createRequestQuoteService,
  RequestQuoteServiceError,
  type RequestQuoteService,
} from "@/modules/request-quote/service";
import {
  customerResolutionStatuses,
  requestSources,
  requestStatuses,
} from "@/modules/request-quote/types";
import {
  quoteReferenceSchema,
  requestReferenceSchema,
} from "@/modules/request-quote/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type StaffRequestRouteParams = { requestId: string };
export type CustomerRequestRouteParams = { requestReference: string };
export type CustomerQuoteRouteParams = { quoteReference: string };
export type RequestSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type RequestPageContext = Readonly<{
  actor: RequestQuoteActor;
  locale: AuthLocale;
}>;

const staffRequestRouteParamsSchema = z
  .object({ requestId: z.uuid() })
  .strict();
const customerRequestRouteParamsSchema = z
  .object({ requestReference: requestReferenceSchema })
  .strict();
const customerQuoteRouteParamsSchema = z
  .object({ quoteReference: quoteReferenceSchema })
  .strict();
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });
const staffRequestSearchParamsSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(requestStatuses).optional(),
    source: z.enum(requestSources).optional(),
    resolutionStatus: z.enum(customerResolutionStatuses).optional(),
    manualReview: z.enum(["required", "not-required"]).optional(),
    submittedFrom: dateOnlySchema.optional(),
    submittedTo: dateOnlySchema.optional(),
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .refine(
        (value) => Number.isSafeInteger(value) && value > 0 && value <= 4_167,
      )
      .optional(),
  })
  .strict();

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): RequestQuoteActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireRequestPageContext(
  authorize: (actor: RequestQuoteActor) => unknown,
): Promise<RequestPageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);

  try {
    authorize(actor);
  } catch (error) {
    if (error instanceof RequestQuoteAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }

  return { actor, locale: principal.profile.preferredLocale };
}

export function requireStaffRequestReadPageContext() {
  return requireRequestPageContext((actor) => requireStaffRequestRead(actor));
}

export function requireStaffRequestManagePageContext() {
  return requireRequestPageContext((actor) =>
    requireStaffRequestManagement(actor),
  );
}

export function requireCustomerRequestReadPageContext() {
  return requireRequestPageContext((actor) => requireCustomerRequestRead(actor));
}

export function requireCustomerRequestUpdatePageContext() {
  return requireRequestPageContext((actor) =>
    requireCustomerRequestUpdate(actor),
  );
}

export function createRequestQuotePageService(): RequestQuoteService {
  return createRequestQuoteService(
    createDatabaseRequestQuoteRepository(getDatabase()),
  );
}

export async function parseStaffRequestRouteParams(
  params: Promise<StaffRequestRouteParams>,
): Promise<StaffRequestRouteParams> {
  const parsed = staffRequestRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseCustomerRequestRouteParams(
  params: Promise<CustomerRequestRouteParams>,
): Promise<CustomerRequestRouteParams> {
  const parsed = customerRequestRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseCustomerQuoteRouteParams(
  params: Promise<CustomerQuoteRouteParams>,
): Promise<CustomerQuoteRouteParams> {
  const parsed = customerQuoteRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseStaffRequestSearchParams(
  searchParams: Promise<RequestSearchParams>,
) {
  const parsed = staffRequestSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const page = parsed.data.page ?? 1;
  const limit = 24;
  const submittedFrom = parsed.data.submittedFrom
    ? new Date(`${parsed.data.submittedFrom}T00:00:00.000Z`)
    : undefined;
  const submittedTo = parsed.data.submittedTo
    ? new Date(
        new Date(`${parsed.data.submittedTo}T00:00:00.000Z`).valueOf() +
          24 * 60 * 60 * 1_000,
      )
    : undefined;
  if (
    submittedFrom &&
    submittedTo &&
    submittedFrom.valueOf() >= submittedTo.valueOf()
  ) {
    notFound();
  }
  return {
    filters: {
      search: parsed.data.search || undefined,
      status: parsed.data.status,
      source: parsed.data.source,
      resolutionStatus: parsed.data.resolutionStatus,
      manualReviewRequired:
        parsed.data.manualReview === undefined
          ? undefined
          : parsed.data.manualReview === "required",
      submittedFrom,
      submittedTo,
      limit,
      offset: (page - 1) * limit,
    },
    page,
    submittedFromValue: parsed.data.submittedFrom,
    submittedToValue: parsed.data.submittedTo,
  };
}

export async function loadStaffRequestOrNotFound(
  service: RequestQuoteService,
  actor: RequestQuoteActor,
  requestId: string,
) {
  try {
    return await service.getRequest(actor, { requestId });
  } catch (error) {
    if (
      error instanceof RequestQuoteServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadCustomerRequestOrNotFound(
  service: RequestQuoteService,
  actor: RequestQuoteActor,
  requestReference: string,
) {
  try {
    return await service.getMyRequest(actor, { requestReference });
  } catch (error) {
    if (
      error instanceof RequestQuoteServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadCustomerQuoteOrNotFound(
  service: RequestQuoteService,
  actor: RequestQuoteActor,
  quoteReference: string,
) {
  try {
    return await service.getMyQuote(actor, { quoteReference });
  } catch (error) {
    if (
      error instanceof RequestQuoteServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}
