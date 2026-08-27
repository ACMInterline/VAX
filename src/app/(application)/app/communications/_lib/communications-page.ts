import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  CommunicationsAuthorizationError,
  requireCustomerCommunicationRead,
  requireStaffCommunicationsRead,
} from "@/modules/communications-documents/policy";
import { createDatabaseCommunicationsRepository } from "@/modules/communications-documents/repository";
import {
  createCommunicationsService,
  CommunicationsServiceError,
  type CommunicationsService,
} from "@/modules/communications-documents/service";
import type { CommunicationsActor } from "@/modules/communications-documents/types";
import {
  communicationListSchema,
  communicationReferenceSchema,
  documentReferenceSchema,
} from "@/modules/communications-documents/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type CommunicationRouteParams = { communicationReference: string };
export type DocumentRouteParams = { documentReference: string };
export type CommunicationSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type CommunicationsPageContext = Readonly<{
  actor: CommunicationsActor;
  locale: AuthLocale;
}>;

const communicationRouteParamsSchema = z
  .object({ communicationReference: communicationReferenceSchema })
  .strict();
const documentRouteParamsSchema = z
  .object({ documentReference: documentReferenceSchema })
  .strict();
const communicationSearchParamsSchema = z
  .object({
    status: communicationListSchema.shape.status,
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .refine((value) => value > 0 && value <= 4_167)
      .optional(),
  })
  .strict();

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): CommunicationsActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireCommunicationsPageContext(
  authorize: (actor: CommunicationsActor) => void,
): Promise<CommunicationsPageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);
  try {
    authorize(actor);
  } catch (error) {
    if (error instanceof CommunicationsAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  return { actor, locale: principal.profile.preferredLocale };
}

export function requireStaffCommunicationsPageContext() {
  return requireCommunicationsPageContext(requireStaffCommunicationsRead);
}

export function requireCustomerCommunicationsPageContext() {
  return requireCommunicationsPageContext(requireCustomerCommunicationRead);
}

export function createCommunicationsPageService(): CommunicationsService {
  return createCommunicationsService(
    createDatabaseCommunicationsRepository(getDatabase()),
  );
}

export async function parseCommunicationRouteParams(
  params: Promise<CommunicationRouteParams>,
): Promise<CommunicationRouteParams> {
  const parsed = communicationRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseDocumentRouteParams(
  params: Promise<DocumentRouteParams>,
): Promise<DocumentRouteParams> {
  const parsed = documentRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseCommunicationSearchParams(
  searchParams: Promise<CommunicationSearchParams>,
) {
  const parsed = communicationSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const page = parsed.data.page ?? 1;
  const limit = 24;
  return {
    filters: {
      status: parsed.data.status,
      limit,
      offset: (page - 1) * limit,
    },
    page,
    status: parsed.data.status,
  };
}

async function loadOrNotFound<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (
      error instanceof CommunicationsServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export function loadStaffCommunicationOrNotFound(
  service: CommunicationsService,
  actor: CommunicationsActor,
  communicationReference: string,
) {
  return loadOrNotFound(() =>
    service.getStaffCommunication(actor, { communicationReference }),
  );
}

export function loadCustomerDocumentOrNotFound(
  service: CommunicationsService,
  actor: CommunicationsActor,
  documentReference: string,
) {
  return loadOrNotFound(() =>
    service.getMyDocument(actor, { documentReference }),
  );
}
