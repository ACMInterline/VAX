import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  businessAuthorityAuditEvents,
  businessAuthorityRecords,
} from "./business-authority";

describe("business-authority schema", () => {
  it("keeps one versioned record and a separate append-only audit table", () => {
    const records = getTableConfig(businessAuthorityRecords);
    const events = getTableConfig(businessAuthorityAuditEvents);
    expect(records.name).toBe("business_authority_records");
    expect(events.name).toBe("business_authority_audit_events");
    expect(records.columns.some((column) => column.name === "authority_value")).toBe(true);
    expect(records.columns.some((column) => column.name === "effective_from")).toBe(true);
    expect(records.columns.some((column) => column.name === "production_ready")).toBe(false);
    expect(events.columns.some((column) => column.name === "correlation_id")).toBe(true);
  });

  it("does not introduce an identity sequence for governance records", () => {
    const records = getTableConfig(businessAuthorityRecords);
    const events = getTableConfig(businessAuthorityAuditEvents);
    expect([...records.columns, ...events.columns].every((column) => !column.generatedIdentity)).toBe(true);
  });
});
