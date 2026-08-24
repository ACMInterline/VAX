import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  CustomerCrmAuthorizationError,
  requireCustomerIdentityLinkManagement,
  requireCustomerSelfRead,
  requireStaffCustomerManagement,
  requireStaffCustomerRead,
} from "@/modules/customer-crm/policy";
import { createDatabaseCustomerCrmRepository } from "@/modules/customer-crm/repository";
import {
  createCustomerCrmService,
  CustomerCrmServiceError,
  type CustomerCrmService,
} from "@/modules/customer-crm/service";
import {
  customerRecordStatuses,
  customerTypes,
  type CustomerCrmActor,
  type CustomerSelfDetail,
  type StaffCustomerDetail,
  type StaffProperty,
} from "@/modules/customer-crm/types";
import { customerIdSchema } from "@/modules/customer-crm/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type CustomerRouteParams = { customerId: string };
export type PropertyRouteParams = CustomerRouteParams & { propertyId: string };
export type CrmSearchParams = Record<
  string,
  string | string[] | undefined
>;

type CrmPageContext = Readonly<{
  actor: CustomerCrmActor;
  locale: AuthLocale;
}>;

const propertyRouteParamsSchema = z
  .object({ customerId: z.uuid(), propertyId: z.uuid() })
  .strict();

const customerSearchParamsSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(customerRecordStatuses).optional(),
    customerType: z.enum(customerTypes).optional(),
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .refine(
        (value) =>
          Number.isSafeInteger(value) && value > 0 && value <= 4_167,
      )
      .optional(),
  })
  .strict();

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): CustomerCrmActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireCrmPageContext(
  authorize: (actor: CustomerCrmActor) => unknown,
): Promise<CrmPageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);

  try {
    authorize(actor);
  } catch (error) {
    if (error instanceof CustomerCrmAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }

  return { actor, locale: principal.profile.preferredLocale };
}

export function requireStaffCrmReadPageContext(): Promise<CrmPageContext> {
  return requireCrmPageContext((actor) => requireStaffCustomerRead(actor));
}

export function requireStaffCrmManagePageContext(): Promise<CrmPageContext> {
  return requireCrmPageContext((actor) => requireStaffCustomerManagement(actor));
}

export function requireStaffCrmIdentityPageContext(): Promise<CrmPageContext> {
  return requireCrmPageContext((actor) =>
    requireCustomerIdentityLinkManagement(actor),
  );
}

export function requireSelfCrmPageContext(): Promise<CrmPageContext> {
  return requireCrmPageContext((actor) => requireCustomerSelfRead(actor));
}

export function createCustomerCrmPageService(): CustomerCrmService {
  return createCustomerCrmService(
    createDatabaseCustomerCrmRepository(getDatabase()),
  );
}

export async function parseCustomerRouteParams(
  params: Promise<CustomerRouteParams>,
): Promise<CustomerRouteParams> {
  const parsed = customerIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parsePropertyRouteParams(
  params: Promise<PropertyRouteParams>,
): Promise<PropertyRouteParams> {
  const parsed = propertyRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseCustomerSearchParams(
  searchParams: Promise<CrmSearchParams>,
) {
  const parsed = customerSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();

  const page = parsed.data.page ?? 1;
  const limit = 24;
  return {
    filters: {
      search: parsed.data.search || undefined,
      status: parsed.data.status,
      customerType: parsed.data.customerType,
      limit,
      offset: (page - 1) * limit,
    },
    page,
  };
}

export async function loadStaffCustomerOrNotFound(
  service: CustomerCrmService,
  actor: CustomerCrmActor,
  customerId: string,
): Promise<StaffCustomerDetail> {
  try {
    return await service.getCustomer(actor, { customerId });
  } catch (error) {
    if (
      error instanceof CustomerCrmServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadStaffPropertyOrNotFound(
  service: CustomerCrmService,
  actor: CustomerCrmActor,
  route: PropertyRouteParams,
): Promise<{ customer: StaffCustomerDetail; property: StaffProperty }> {
  const customer = await loadStaffCustomerOrNotFound(
    service,
    actor,
    route.customerId,
  );
  const property = customer.properties.find(
    (candidate) => candidate.id === route.propertyId,
  );
  if (!property) notFound();
  return { customer, property };
}

export async function loadLinkedCustomerFromSummary(
  service: CustomerCrmService,
  actor: CustomerCrmActor,
  id: string,
): Promise<CustomerSelfDetail | null> {
  try {
    return await service.getMyCustomer(actor, { customerId: id });
  } catch (error) {
    if (
      error instanceof CustomerCrmServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      return null;
    }
    throw error;
  }
}
