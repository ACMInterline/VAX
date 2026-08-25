import "server-only";

import { asc, eq } from "drizzle-orm";
import type { AuthLocale } from "@/auth/validation";
import type { Database } from "@/db/client";
import {
  measurementModes,
  serviceAddons,
  services,
} from "@/db/schema/service-catalogue";
import type {
  RequestCustomerOption,
} from "@/components/request-quote/request-create-form";
import type { RequestNormalizationOptions } from "@/components/request-quote/staff-workflow-forms";
import { getCustomerCrmCatalogueOptions } from "@/modules/customer-crm/catalogue-options";
import {
  CustomerCrmServiceError,
  type CustomerCrmService,
} from "@/modules/customer-crm/service";
import type {
  CustomerCrmActor,
  CustomerSelfDetail,
  StaffCustomerDetail,
} from "@/modules/customer-crm/types";

function customerOption(
  customer: CustomerSelfDetail | StaffCustomerDetail,
): RequestCustomerOption {
  return {
    id: customer.id,
    label: customer.displayName,
    properties: customer.properties
      .filter((property) => property.status === "ACTIVE")
      .map((property) => ({
        id: property.id,
        label: property.label,
        assets: property.cleaningAssets
          .filter((asset) => asset.status === "ACTIVE")
          .map((asset) => ({ id: asset.id, label: asset.label })),
      })),
  };
}

export async function loadStaffRequestCustomerOptions(
  service: CustomerCrmService,
  actor: CustomerCrmActor,
): Promise<readonly RequestCustomerOption[]> {
  const page = await service.listCustomers(actor, {
    status: "ACTIVE",
    limit: 100,
    offset: 0,
  });
  const details = await Promise.all(
    page.items.map((customer) =>
      service.getCustomer(actor, { customerId: customer.id }),
    ),
  );
  return details.map(customerOption);
}

export async function loadCustomerRequestCustomerOptions(
  service: CustomerCrmService,
  actor: CustomerCrmActor,
): Promise<readonly RequestCustomerOption[]> {
  const summaries = await service.listMyCustomers(actor);
  const details = await Promise.all(
    summaries.map(async (customer) => {
      try {
        return await service.getMyCustomer(actor, { customerId: customer.id });
      } catch (error) {
        if (
          error instanceof CustomerCrmServiceError &&
          error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
        ) {
          return null;
        }
        throw error;
      }
    }),
  );
  return details
    .filter((customer): customer is CustomerSelfDetail => customer !== null)
    .map(customerOption);
}

export async function getRequestNormalizationOptions(
  database: Database,
  locale: AuthLocale,
): Promise<
  Omit<RequestNormalizationOptions, "assets"> & {
    serviceZones: readonly Readonly<{ id: number; label: string }>[];
  }
> {
  const [crmCatalogue, serviceRows, modeRows, addonRows] = await Promise.all([
    getCustomerCrmCatalogueOptions(database, locale),
    database
      .select({
        id: services.id,
        label: locale === "en" ? services.labelEn : services.labelBg,
      })
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.sortOrder), asc(services.code), asc(services.id)),
    database
      .select({
        id: measurementModes.id,
        label:
          locale === "en" ? measurementModes.labelEn : measurementModes.labelBg,
      })
      .from(measurementModes)
      .where(eq(measurementModes.active, true))
      .orderBy(
        asc(measurementModes.sortOrder),
        asc(measurementModes.code),
        asc(measurementModes.id),
      ),
    database
      .select({
        id: serviceAddons.id,
        label: locale === "en" ? serviceAddons.labelEn : serviceAddons.labelBg,
      })
      .from(serviceAddons)
      .where(eq(serviceAddons.active, true))
      .orderBy(
        asc(serviceAddons.sortOrder),
        asc(serviceAddons.code),
        asc(serviceAddons.id),
      ),
  ]);

  return {
    services: serviceRows,
    itemTypes: crmCatalogue.itemTypes,
    measurementModes: modeRows,
    conditionLevels: crmCatalogue.conditionLevels,
    fibreMaterials: crmCatalogue.fibreMaterials,
    surfaceConstructions: crmCatalogue.surfaceConstructions,
    issueTypes: crmCatalogue.issueTypes,
    addons: addonRows,
    serviceZones: crmCatalogue.serviceZones,
  };
}
