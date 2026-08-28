import { sql } from "drizzle-orm";
import { getDatabase } from "./client";
import {
  vaxDatabaseRoles,
  vaxDatabaseTableNames,
  vaxMigrationHashes,
} from "./database-security-policy";

export type DatabaseHealth = "connected" | "unavailable";
export type DatabaseProbe = () => Promise<void>;
export type OperationalDatabaseReadiness = Readonly<{
  connected: boolean;
  runtimeIdentitySafe: boolean;
  migrationReady: boolean;
  rateLimitPrivilegesReady: boolean;
}>;

const expectedTableNames = sql.join(
  vaxDatabaseTableNames.map((tableName) => sql`${tableName}`),
  sql`, `,
);
const expectedMigrationHashes = sql.join(
  vaxMigrationHashes.map((hash) => sql`${hash}`),
  sql`, `,
);
const expectedRateLimitColumns = JSON.stringify([
  ["scope", "character varying(40)", true, false],
  ["key_hash", "character varying(64)", true, false],
  ["attempt_count", "integer", true, true],
  ["window_started_at", "timestamp with time zone", true, true],
  ["resets_at", "timestamp with time zone", true, false],
  ["updated_at", "timestamp with time zone", true, true],
]);
const expectedRateLimitConstraints = sql.join(
  [
    "operational_rate_limits_attempt_count_not_null",
    "operational_rate_limits_attempt_count_positive",
    "operational_rate_limits_key_hash_not_null",
    "operational_rate_limits_key_hash_valid",
    "operational_rate_limits_resets_at_not_null",
    "operational_rate_limits_scope_key_hash_pk",
    "operational_rate_limits_scope_not_null",
    "operational_rate_limits_scope_valid",
    "operational_rate_limits_updated_at_not_null",
    "operational_rate_limits_updated_at_valid",
    "operational_rate_limits_window_started_at_not_null",
    "operational_rate_limits_window_valid",
  ].map((name) => sql`${name}`),
  sql`, `,
);
const expectedRateLimitIndexes = sql.join(
  [
    "operational_rate_limits_expiry_idx",
    "operational_rate_limits_scope_key_hash_pk",
  ].map((name) => sql`${name}`),
  sql`, `,
);
const expectedRateLimitPolicies = sql.join(
  [
    "vax_runtime_delete_expired",
    "vax_runtime_insert",
    "vax_runtime_select",
    "vax_runtime_update",
  ].map((name) => sql`${name}`),
  sql`, `,
);

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

export async function checkOperationalDatabaseReadiness(): Promise<OperationalDatabaseReadiness> {
  try {
    const result = await getDatabase().execute<{
      runtime_identity_safe: boolean;
      migration_ready: boolean;
      rate_limit_privileges_ready: boolean;
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
      ) as runtime_identity_safe,
      (
        (select count(*)::integer
          from pg_class application_table
          join pg_namespace application_schema
            on application_schema.oid = application_table.relnamespace
          where application_schema.nspname = 'public'
            and application_table.relkind in ('r', 'p')
        ) = ${vaxDatabaseTableNames.length}
        and not exists (
          select 1
          from unnest(array[${expectedTableNames}]::text[])
            as expected(table_name)
          where to_regclass(format('public.%I', expected.table_name)) is null
        )
        and public.vax_migration_history_hashes() =
          array[${expectedMigrationHashes}]::text[]
        and (
          select jsonb_agg(
            jsonb_build_array(
              column_attribute.attname,
              format_type(
                column_attribute.atttypid,
                column_attribute.atttypmod
              ),
              column_attribute.attnotnull,
              column_default.oid is not null
            ) order by column_attribute.attnum
          )
          from pg_attribute column_attribute
          left join pg_attrdef column_default
            on column_default.adrelid = column_attribute.attrelid
            and column_default.adnum = column_attribute.attnum
          where column_attribute.attrelid =
            'public.operational_rate_limits'::regclass
            and column_attribute.attnum > 0
            and not column_attribute.attisdropped
        ) = ${expectedRateLimitColumns}::jsonb
        and (
          select array_agg(
            constraint_object.conname::text order by constraint_object.conname
          )
          from pg_constraint constraint_object
          where constraint_object.conrelid =
            'public.operational_rate_limits'::regclass
        ) = array[${expectedRateLimitConstraints}]::text[]
        and (
          select array_agg(index_object.relname::text order by index_object.relname)
          from pg_index table_index
          join pg_class index_object on index_object.oid = table_index.indexrelid
          where table_index.indrelid =
            'public.operational_rate_limits'::regclass
        ) = array[${expectedRateLimitIndexes}]::text[]
        and (
          select array_agg(
            policy.policyname::text order by policy.policyname
          )
          from pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'operational_rate_limits'
        ) = array[${expectedRateLimitPolicies}]::text[]
        and exists (
          select 1
          from pg_proc readiness_function
          join pg_namespace readiness_schema
            on readiness_schema.oid = readiness_function.pronamespace
          where readiness_schema.nspname = 'public'
            and readiness_function.proname = 'vax_migration_history_hashes'
            and readiness_function.pronargs = 0
            and readiness_function.prosecdef
            and pg_get_userbyid(readiness_function.proowner) =
              ${vaxDatabaseRoles.migrator}
            and has_function_privilege(
              ${vaxDatabaseRoles.runtime},
              readiness_function.oid,
              'EXECUTE'
            )
            and not has_function_privilege(
              'authenticated', readiness_function.oid, 'EXECUTE'
            )
            and not has_function_privilege(
              'anonymous', readiness_function.oid, 'EXECUTE'
            )
        )
      ) as migration_ready,
      case when to_regclass('public.operational_rate_limits') is null then false
      else (
        has_table_privilege(
          current_user,
          'public.operational_rate_limits',
          'SELECT,INSERT,UPDATE,DELETE'
        )
        and not has_table_privilege(
          'authenticated',
          'public.operational_rate_limits',
          'SELECT,INSERT,UPDATE,DELETE'
        )
        and not has_table_privilege(
          'anonymous',
          'public.operational_rate_limits',
          'SELECT,INSERT,UPDATE,DELETE'
        )
        and exists (
          select 1
          from pg_class rate_limit_table
          join pg_namespace rate_limit_schema
            on rate_limit_schema.oid = rate_limit_table.relnamespace
          where rate_limit_schema.nspname = 'public'
            and rate_limit_table.relname = 'operational_rate_limits'
            and rate_limit_table.relrowsecurity
        )
      ) end as rate_limit_privileges_ready
      from pg_roles role where role.rolname = current_user
    `);
    const row = result.rows[0];
    return {
      connected: true,
      runtimeIdentitySafe: row?.runtime_identity_safe === true,
      migrationReady: row?.migration_ready === true,
      rateLimitPrivilegesReady: row?.rate_limit_privileges_ready === true,
    };
  } catch {
    return {
      connected: false,
      runtimeIdentitySafe: false,
      migrationReady: false,
      rateLimitPrivilegesReady: false,
    };
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
