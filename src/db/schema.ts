import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const systemMetadata = pgTable("system_metadata", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export * from "./schema/service-catalogue";
export * from "./schema/commercial-engine";
export * from "./schema/availability-engine";
export * from "./schema/identity-access";
export * from "./schema/customer-crm";
export * from "./schema/request-quote";
export * from "./schema/booking-engine";
export * from "./schema/job-execution";
export * from "./schema/finance-invoicing";
export * from "./schema/communications-documents";
export * from "./schema/operational-readiness";
export * from "./schema/business-authority";
