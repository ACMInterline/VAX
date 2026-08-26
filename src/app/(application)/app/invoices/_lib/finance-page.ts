import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  FinanceAuthorizationError,
  requireCustomerInvoiceRead,
  requireStaffFinanceRead,
  type FinanceActor,
} from "@/modules/finance-invoicing/policy";
import { createDatabaseFinanceRepository } from "@/modules/finance-invoicing/repository";
import {
  createFinanceService,
  FinanceServiceError,
  type FinanceService,
} from "@/modules/finance-invoicing/service";
import { invoiceStoredStatuses } from "@/modules/finance-invoicing/types";
import { invoiceReferenceSchema } from "@/modules/finance-invoicing/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type InvoiceRouteParams = { invoiceReference: string };
export type FinanceSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type FinancePageContext = Readonly<{
  actor: FinanceActor;
  locale: AuthLocale;
}>;

const invoiceRouteParamsSchema = z
  .object({ invoiceReference: invoiceReferenceSchema })
  .strict();
const staffInvoiceSearchParamsSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum([...invoiceStoredStatuses, "OVERDUE"]).optional(),
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
): FinanceActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireFinancePageContext(
  authorize: (actor: FinanceActor) => void,
): Promise<FinancePageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);
  try {
    authorize(actor);
  } catch (error) {
    if (error instanceof FinanceAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  return { actor, locale: principal.profile.preferredLocale };
}

export function requireStaffFinancePageContext() {
  return requireFinancePageContext(requireStaffFinanceRead);
}

export function requireCustomerFinancePageContext() {
  return requireFinancePageContext(requireCustomerInvoiceRead);
}

export function createFinancePageService(): FinanceService {
  return createFinanceService(
    createDatabaseFinanceRepository(getDatabase()),
  );
}

export async function parseInvoiceRouteParams(
  params: Promise<InvoiceRouteParams>,
): Promise<InvoiceRouteParams> {
  const parsed = invoiceRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseStaffInvoiceSearchParams(
  searchParams: Promise<FinanceSearchParams>,
) {
  const parsed = staffInvoiceSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const page = parsed.data.page ?? 1;
  const limit = 24;
  return {
    filters: {
      search: parsed.data.search || undefined,
      status: parsed.data.status,
      limit,
      offset: (page - 1) * limit,
    },
    page,
    searchValue: parsed.data.search,
    statusValue: parsed.data.status,
  };
}

async function loadInvoiceOrNotFound<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (
      error instanceof FinanceServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export function loadStaffInvoiceOrNotFound(
  service: FinanceService,
  actor: FinanceActor,
  invoiceReference: string,
) {
  return loadInvoiceOrNotFound(() =>
    service.getInvoice(actor, { invoiceReference }),
  );
}

export function loadCustomerInvoiceOrNotFound(
  service: FinanceService,
  actor: FinanceActor,
  invoiceReference: string,
) {
  return loadInvoiceOrNotFound(() =>
    service.getMyInvoice(actor, { invoiceReference }),
  );
}
