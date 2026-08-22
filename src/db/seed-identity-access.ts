import { inArray, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  canonicalPermissions,
  canonicalRoles,
  rolePermissionRows,
} from "@/modules/identity-access/policy";
import * as tables from "./schema/identity-access";

function idMap(rows: readonly { id: number; code: string }[]) {
  return new Map(rows.map((row) => [row.code, row.id]));
}

function requiredId(ids: ReadonlyMap<string, number>, code: string): number {
  const id = ids.get(code);
  if (id === undefined) {
    throw new Error(`Canonical identity-access code was not persisted: ${code}`);
  }
  return id;
}

export const canonicalRoleConflictUpdate = {
  labelBg: sql`excluded."label_bg"`,
  labelEn: sql`excluded."label_en"`,
  description: sql`excluded."description"`,
  systemRole: true,
  updatedAt: sql`now()`,
} as const;

export const canonicalPermissionConflictUpdate = {
  description: sql`excluded."description"`,
  updatedAt: sql`now()`,
} as const;

export async function seedIdentityAccess(database: Database): Promise<void> {
  await database.batch([
    database
      .insert(tables.applicationRoles)
      .values(
        canonicalRoles.map((role) => ({
          ...role,
          systemRole: true,
          active: true,
        })),
      )
      .onConflictDoUpdate({
        target: tables.applicationRoles.code,
        set: canonicalRoleConflictUpdate,
      }),
    database
      .insert(tables.permissions)
      .values(
        canonicalPermissions.map((permission) => ({
          ...permission,
          active: true,
        })),
      )
      .onConflictDoUpdate({
        target: tables.permissions.code,
        set: canonicalPermissionConflictUpdate,
      }),
  ]);

  const [roleRows, permissionRows] = await Promise.all([
    database
      .select({ id: tables.applicationRoles.id, code: tables.applicationRoles.code })
      .from(tables.applicationRoles),
    database
      .select({ id: tables.permissions.id, code: tables.permissions.code })
      .from(tables.permissions),
  ]);
  const roleIds = idMap(roleRows);
  const permissionIds = idMap(permissionRows);
  const canonicalRoleIds = canonicalRoles.map((role) =>
    requiredId(roleIds, role.code),
  );

  const mappings = rolePermissionRows().map((mapping) => ({
    roleId: requiredId(roleIds, mapping.roleCode),
    permissionId: requiredId(permissionIds, mapping.permissionCode),
  }));

  await database.batch([
    database
      .delete(tables.rolePermissions)
      .where(inArray(tables.rolePermissions.roleId, canonicalRoleIds)),
    database.insert(tables.rolePermissions).values(mappings),
  ]);
}
