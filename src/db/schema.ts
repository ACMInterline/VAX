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
