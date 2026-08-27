import { sql } from "drizzle-orm";
import { getDatabase } from "./client";
import { vaxDatabaseRoles } from "./database-security-policy";

export type DatabaseHealth = "connected" | "unavailable";
export type DatabaseProbe = () => Promise<void>;

async function executeConnectivityProbe(): Promise<void> {
  const result = await getDatabase().execute<{
    safe_runtime_identity: boolean;
  }>(sql`
    select (
      current_user = ${vaxDatabaseRoles.runtime}
      and role.rolcanlogin
      and not role.rolsuper
      and not role.rolinherit
      and not role.rolcreaterole
      and not role.rolcreatedb
      and not role.rolreplication
      and not role.rolbypassrls
      and not has_database_privilege(
        current_user,
        current_database(),
        'CREATE'
      )
      and not has_schema_privilege(current_user, 'public', 'CREATE')
      and not exists (
        select 1
        from pg_class owned_object
        join pg_namespace owned_schema
          on owned_schema.oid = owned_object.relnamespace
        where owned_object.relowner = role.oid
          and owned_schema.nspname in ('public', 'drizzle')
      )
      and not exists (
        select 1 from pg_auth_members membership
        where membership.member = role.oid
      )
    ) as safe_runtime_identity
    from pg_roles role
    where role.rolname = current_user
  `);
  if (result.rows[0]?.safe_runtime_identity !== true) {
    throw new Error("Unsafe database runtime identity.");
  }
}

export async function checkDatabaseConnection(
  probe: DatabaseProbe = executeConnectivityProbe,
): Promise<DatabaseHealth> {
  try {
    await probe();
    return "connected";
  } catch {
    return "unavailable";
  }
}
