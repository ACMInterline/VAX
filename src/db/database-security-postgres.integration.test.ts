import { randomBytes, randomUUID } from "node:crypto";
import { drizzle as nodePostgresDrizzle } from "drizzle-orm/node-postgres";
import { Client, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getDatabaseAdminUrl,
  getDatabaseUrl,
  getMigrationDatabaseUrl,
} from "@/lib/environment";
import { acceptQuoteRecord } from "@/modules/booking-engine/repository";
import { updateOwnCommunicationPreferences } from "@/modules/communications-documents/repository";
import { createCustomerRecord } from "@/modules/customer-crm/repository";
import { createInvoiceDraftRecord } from "@/modules/finance-invoicing/repository";
import { createJobFromBookingRecord } from "@/modules/job-execution/repository";
import {
  createPublicCodeRequestRecord,
  createQuoteDraftRecord,
} from "@/modules/request-quote/repository";
import { createDatabaseSchedulingDispatchRepository } from "@/modules/scheduling-dispatch/repository";
import {
  databaseSecurityTablePolicy,
  type RuntimeTablePrivilege,
  vaxDatabaseRoles,
  vaxDatabaseTableNames,
  vaxRuntimeLockPolicy,
  vaxRuntimeLockTableNames,
  vaxTriggerFunctionNames,
} from "./database-security-policy";
import {
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";

vi.mock("server-only", () => ({}));

const runLiveIntegration =
  process.env.RUN_PHASE3K_DATABASE_SECURITY_INTEGRATION === "1";

type BatchQuery = PromiseLike<unknown> &
  Readonly<{
    getQuery(): Readonly<{ sql: string }>;
  }>;

type DatabaseIdentity = Readonly<{
  project_id: string | null;
  branch_id: string | null;
  database_name: string;
  role_name: string;
}>;

function addTransactionalBatch(database: object): Database {
  const adapted = database as Database;
  const batchTarget = adapted as unknown as {
    batch: (queries: readonly BatchQuery[]) => Promise<readonly unknown[]>;
  };
  batchTarget.batch = async (queries) => {
    const first = queries[0];
    const hasIsolationDeclaration =
      first?.getQuery().sql.trim().toLowerCase() ===
      "set transaction isolation level read committed";
    const results: unknown[] = hasIsolationDeclaration
      ? [{ rows: [], rowCount: 0 }]
      : [];
    for (const query of hasIsolationDeclaration ? queries.slice(1) : queries) {
      results.push(await query);
    }
    return results;
  };
  return adapted;
}

function token(): string {
  return randomBytes(12).toString("hex").toUpperCase();
}

async function identity(
  client: Client | PoolClient,
): Promise<DatabaseIdentity> {
  const result = await client.query<DatabaseIdentity>(`
    select current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id,
      current_database() as database_name,
      current_user as role_name
  `);
  if (!result.rows[0]) throw new Error("Database identity is unavailable.");
  return result.rows[0];
}

function expectDevelopmentIdentity(
  actual: DatabaseIdentity,
  expectedRole: string,
): void {
  expect(actual).toEqual({
    project_id: process.env.DATABASE_MUTATION_EXPECTED_PROJECT_ID,
    branch_id: process.env.DATABASE_MUTATION_EXPECTED_BRANCH_ID,
    database_name: process.env.DATABASE_MUTATION_EXPECTED_DATABASE,
    role_name: expectedRole,
  });
}

async function expectDenied(client: Client, statement: string): Promise<void> {
  await expect(client.query(statement)).rejects.toMatchObject({
    code: "42501",
  });
}

describe.runIf(runLiveIntegration)(
  "Phase 3K PostgreSQL least-privilege boundary",
  () => {
    let runtimeUrl: string;
    let migrationUrl: string;
    let adminUrl: string;
    let admin: Client;

    beforeAll(async () => {
      loadMigrationEnvironment();
      assertDevelopmentDatabaseMutationTarget(process.env, "runtime");
      assertDevelopmentDatabaseMutationTarget(process.env, "migration");
      assertDevelopmentDatabaseMutationTarget(process.env, "admin");
      runtimeUrl = getDatabaseUrl();
      migrationUrl = getMigrationDatabaseUrl();
      adminUrl = getDatabaseAdminUrl();
      admin = new Client({ connectionString: adminUrl });
      await admin.connect();
      const adminIdentity = await identity(admin);
      expectDevelopmentIdentity(
        adminIdentity,
        process.env.DATABASE_ADMIN_EXPECTED_ROLE!,
      );
    });

    afterAll(async () => {
      await admin?.end();
    });

    it("uses distinct live development identities with a non-owner runtime", async () => {
      for (const [connectionString, role] of [
        [runtimeUrl, vaxDatabaseRoles.runtime],
        [migrationUrl, vaxDatabaseRoles.migrator],
      ] as const) {
        const client = new Client({ connectionString });
        await client.connect();
        try {
          expectDevelopmentIdentity(await identity(client), role);
        } finally {
          await client.end();
        }
      }

      const result = await admin.query<{
        rolname: string;
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolinherit: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
        membership_count: number;
        owned_runtime_objects: number;
      }>(
        `
        select role.rolname, role.rolcanlogin, role.rolsuper, role.rolinherit,
          role.rolcreaterole, role.rolcreatedb, role.rolreplication,
          role.rolbypassrls,
          (select count(*)::integer from pg_auth_members membership
            where membership.member = role.oid) as membership_count,
          (select count(*)::integer from pg_class object
            join pg_namespace schema on schema.oid = object.relnamespace
            where object.relowner = role.oid
              and schema.nspname in ('public', 'drizzle'))
            as owned_runtime_objects
        from pg_roles role
        where role.rolname = any($1::text[])
        order by role.rolname
      `,
        [[vaxDatabaseRoles.migrator, vaxDatabaseRoles.runtime]],
      );

      expect(result.rows).toHaveLength(2);
      for (const role of result.rows) {
        expect(role).toMatchObject({
          rolcanlogin: true,
          rolsuper: false,
          rolinherit: false,
          rolcreaterole: false,
          rolcreatedb: false,
          rolreplication: false,
          rolbypassrls: false,
          membership_count: 0,
        });
      }
      expect(
        result.rows.find((role) => role.rolname === vaxDatabaseRoles.runtime)
          ?.owned_runtime_objects,
      ).toBe(0);

      const databasePrivileges = await admin.query<{
        role_name: string;
        database_create: boolean;
      }>(
        `
        select role_name,
          has_database_privilege(role_name, current_database(), 'CREATE')
            as database_create
        from unnest($1::text[]) role_name
        order by role_name
      `,
        [[vaxDatabaseRoles.migrator, vaxDatabaseRoles.runtime]],
      );
      expect(databasePrivileges.rows).toEqual([
        {
          role_name: vaxDatabaseRoles.migrator,
          database_create: true,
        },
        {
          role_name: vaxDatabaseRoles.runtime,
          database_create: false,
        },
      ]);
    });

    it("matches ownership, RLS, policies, grants, sequences, functions and triggers to the reviewed inventory", async () => {
      const tables = await admin.query<{
        table_name: string;
        owner: string;
        rls_enabled: boolean;
        rls_forced: boolean;
      }>(`
        select object.relname as table_name, owner.rolname as owner,
          object.relrowsecurity as rls_enabled,
          object.relforcerowsecurity as rls_forced
        from pg_class object
        join pg_namespace schema on schema.oid = object.relnamespace
        join pg_roles owner on owner.oid = object.relowner
        where schema.nspname = 'public' and object.relkind = 'r'
        order by object.relname
      `);
      expect(tables.rows.map((table) => table.table_name)).toEqual(
        vaxDatabaseTableNames,
      );
      expect(
        tables.rows.every(
          (table) =>
            table.owner === vaxDatabaseRoles.migrator &&
            table.rls_enabled &&
            !table.rls_forced,
        ),
      ).toBe(true);

      const policies = await admin.query<{
        table_name: string;
        command: RuntimeTablePrivilege;
        roles: string[];
        permissive: string;
      }>(`
        select tablename as table_name, cmd as command,
          roles::text[] as roles, permissive
        from pg_policies
        where schemaname = 'public'
        order by tablename, cmd
      `);
      const expectedPolicies = Object.entries(databaseSecurityTablePolicy)
        .flatMap(([tableName, policy]) =>
          policy.runtime.map((command) => ({
            table_name: tableName,
            command,
            roles: [vaxDatabaseRoles.runtime],
            permissive: "PERMISSIVE",
          })),
        )
        .concat(
          vaxRuntimeLockTableNames.map((tableName) => ({
            table_name: tableName,
            command: "UPDATE" as RuntimeTablePrivilege,
            roles: [vaxDatabaseRoles.runtime],
            permissive: "PERMISSIVE",
          })),
        )
        .sort((left, right) =>
          `${left.table_name}:${left.command}`.localeCompare(
            `${right.table_name}:${right.command}`,
          ),
        );
      expect(policies.rows).toEqual(expectedPolicies);

      const privileges = await admin.query<{
        table_name: string;
        role_name: string;
        privilege: RuntimeTablePrivilege;
        allowed: boolean;
      }>(
        `
        select table_name, role_name, privilege,
          has_table_privilege(
            role_name, format('public.%I', table_name), privilege
          ) as allowed
        from unnest($1::text[]) table_name
        cross join unnest($2::text[]) role_name
        cross join unnest($3::text[]) privilege
        order by table_name, role_name, privilege
      `,
        [
          vaxDatabaseTableNames,
          [vaxDatabaseRoles.runtime, "authenticated", "anonymous"],
          ["SELECT", "INSERT", "UPDATE", "DELETE"],
        ],
      );
      for (const tableName of vaxDatabaseTableNames) {
        const expectedRuntime = new Set<RuntimeTablePrivilege>(
          databaseSecurityTablePolicy[tableName].runtime,
        );
        for (const privilege of privileges.rows.filter(
          (item) => item.table_name === tableName,
        )) {
          expect(privilege.allowed).toBe(
            privilege.role_name === vaxDatabaseRoles.runtime &&
              expectedRuntime.has(privilege.privilege),
          );
        }
      }

      const lockPrivileges = await admin.query<{
        table_name: string;
        column_name: string;
        runtime_id_update: boolean;
        lock_using: string | null;
        lock_check: string | null;
      }>(
        `
        select table_name, column_name,
          has_column_privilege(
            'vax_runtime', format('public.%I', table_name), column_name,
            'UPDATE'
          ) as runtime_id_update,
          (select policy.qual from pg_policies policy
            where policy.schemaname = 'public'
              and policy.tablename = table_name
              and policy.policyname = 'vax_runtime_lock') as lock_using,
          (select policy.with_check from pg_policies policy
            where policy.schemaname = 'public'
              and policy.tablename = table_name
              and policy.policyname = 'vax_runtime_lock') as lock_check
        from unnest($1::text[], $2::text[])
          as lock_policy(table_name, column_name)
        order by table_name
      `,
        [
          vaxRuntimeLockPolicy.map((policy) => policy.tableName),
          vaxRuntimeLockPolicy.map((policy) => policy.columnName),
        ],
      );
      expect(lockPrivileges.rows).toEqual(
        vaxRuntimeLockPolicy.map((policy) => ({
          table_name: policy.tableName,
          column_name: policy.columnName,
          runtime_id_update: true,
          lock_using: "true",
          lock_check: "false",
        })),
      );

      const sequences = await admin.query<{
        sequence_name: string;
        owner: string;
        runtime_usage: boolean;
        authenticated_usage: boolean;
        anonymous_usage: boolean;
      }>(`
        select sequence.relname as sequence_name, owner.rolname as owner,
          has_sequence_privilege('vax_runtime', sequence.oid, 'USAGE')
            as runtime_usage,
          has_sequence_privilege('authenticated', sequence.oid, 'USAGE')
            as authenticated_usage,
          has_sequence_privilege('anonymous', sequence.oid, 'USAGE')
            as anonymous_usage
        from pg_class sequence
        join pg_namespace schema on schema.oid = sequence.relnamespace
        join pg_roles owner on owner.oid = sequence.relowner
        where schema.nspname = 'public' and sequence.relkind = 'S'
        order by sequence.relname
      `);
      expect(sequences.rows).toHaveLength(40);
      expect(
        sequences.rows.every(
          (sequence) =>
            sequence.owner === vaxDatabaseRoles.migrator &&
            !sequence.runtime_usage &&
            !sequence.authenticated_usage &&
            !sequence.anonymous_usage,
        ),
      ).toBe(true);

      const functions = await admin.query<{
        function_name: string;
        owner: string;
        security_definer: boolean;
        runtime_execute: boolean;
        authenticated_execute: boolean;
        anonymous_execute: boolean;
      }>(
        `
        select function.proname as function_name, owner.rolname as owner,
          function.prosecdef as security_definer,
          has_function_privilege('vax_runtime', function.oid, 'EXECUTE')
            as runtime_execute,
          has_function_privilege('authenticated', function.oid, 'EXECUTE')
            as authenticated_execute,
          has_function_privilege('anonymous', function.oid, 'EXECUTE')
            as anonymous_execute
        from pg_proc function
        join pg_namespace schema on schema.oid = function.pronamespace
        join pg_roles owner on owner.oid = function.proowner
        where schema.nspname = 'public' and function.proname = any($1::text[])
        order by function.proname
      `,
        [vaxTriggerFunctionNames],
      );
      expect(functions.rows.map((item) => item.function_name)).toEqual(
        vaxTriggerFunctionNames,
      );
      expect(
        functions.rows.every(
          (item) =>
            item.owner === vaxDatabaseRoles.migrator &&
            !item.security_definer &&
            !item.runtime_execute &&
            !item.authenticated_execute &&
            !item.anonymous_execute,
        ),
      ).toBe(true);

      const triggers = await admin.query<{ enabled: string; count: number }>(`
        select trigger.tgenabled as enabled, count(*)::integer as count
        from pg_trigger trigger
        join pg_class table_object on table_object.oid = trigger.tgrelid
        join pg_namespace schema on schema.oid = table_object.relnamespace
        where schema.nspname = 'public' and not trigger.tgisinternal
        group by trigger.tgenabled
      `);
      expect(triggers.rows).toEqual([{ enabled: "O", count: 37 }]);

      const drizzleBoundary = await admin.query<{
        object_name: string;
        object_kind: string;
        owner: string;
        runtime_access: boolean;
      }>(`
        select object.relname as object_name,
          case object.relkind when 'r' then 'TABLE' else 'SEQUENCE' end
            as object_kind,
          owner.rolname as owner,
          case object.relkind
            when 'r' then has_table_privilege(
              'vax_runtime', object.oid, 'SELECT'
            )
            else has_sequence_privilege(
              'vax_runtime', object.oid, 'USAGE'
            )
          end as runtime_access
        from pg_class object
        join pg_namespace schema on schema.oid = object.relnamespace
        join pg_roles owner on owner.oid = object.relowner
        where schema.nspname = 'drizzle'
          and object.relkind in ('r', 'S')
        order by object.relkind, object.relname
      `);
      expect(drizzleBoundary.rows).toEqual([
        {
          object_name: "__drizzle_migrations_id_seq",
          object_kind: "SEQUENCE",
          owner: vaxDatabaseRoles.migrator,
          runtime_access: false,
        },
        {
          object_name: "__drizzle_migrations",
          object_kind: "TABLE",
          owner: vaxDatabaseRoles.migrator,
          runtime_access: false,
        },
      ]);

      const drizzleSchema = await admin.query<{
        role_name: string;
        schema_usage: boolean;
        schema_create: boolean;
      }>(
        `
        select role_name,
          has_schema_privilege(role_name, 'drizzle', 'USAGE') as schema_usage,
          has_schema_privilege(role_name, 'drizzle', 'CREATE') as schema_create
        from unnest($1::text[]) role_name
        order by role_name
      `,
        [[vaxDatabaseRoles.migrator, vaxDatabaseRoles.runtime]],
      );
      expect(drizzleSchema.rows).toEqual([
        {
          role_name: vaxDatabaseRoles.migrator,
          schema_usage: true,
          schema_create: true,
        },
        {
          role_name: vaxDatabaseRoles.runtime,
          schema_usage: false,
          schema_create: false,
        },
      ]);
    });

    it("classifies every non-system function without crossing the provider boundary", async () => {
      const functions = await admin.query<{
        schema_name: string;
        function_name: string;
        signature: string;
        owner: string;
        security_definer: boolean;
        extension_managed: boolean;
      }>(`
        select schema.nspname as schema_name,
          function_object.proname as function_name,
          function_object.oid::regprocedure::text as signature,
          owner.rolname as owner,
          function_object.prosecdef as security_definer,
          extension.oid is not null as extension_managed
        from pg_proc function_object
        join pg_namespace schema on schema.oid = function_object.pronamespace
        join pg_roles owner on owner.oid = function_object.proowner
        left join pg_depend dependency
          on dependency.classid = 'pg_proc'::regclass
          and dependency.objid = function_object.oid
          and dependency.deptype = 'e'
        left join pg_extension extension
          on extension.oid = dependency.refobjid
        where schema.nspname not in ('pg_catalog', 'information_schema')
          and schema.nspname not like 'pg_toast%'
        order by schema.nspname, function_object.oid::regprocedure::text
      `);

      const vaxFunctionNames = new Set<string>(vaxTriggerFunctionNames);
      const vaxFunctions = functions.rows.filter(
        (item) =>
          item.schema_name === "public" &&
          vaxFunctionNames.has(item.function_name),
      );
      const publicExtensionFunctions = functions.rows.filter(
        (item) => item.schema_name === "public" && item.extension_managed,
      );
      const unmanagedPublicFunctions = functions.rows.filter(
        (item) =>
          item.schema_name === "public" &&
          !item.extension_managed &&
          !vaxFunctionNames.has(item.function_name),
      );
      const providerFunctions = functions.rows.filter(
        (item) => !vaxFunctions.includes(item),
      );

      expect(functions.rows).toHaveLength(241);
      expect(vaxFunctions).toHaveLength(vaxTriggerFunctionNames.length);
      expect(publicExtensionFunctions).toHaveLength(212);
      expect(
        unmanagedPublicFunctions.map((item) => ({
          signature: item.signature,
          security_definer: item.security_definer,
          owned_by_vax_role:
            item.owner === vaxDatabaseRoles.migrator ||
            item.owner === vaxDatabaseRoles.runtime,
        })),
      ).toEqual([
        {
          signature: "show_db_tree()",
          security_definer: false,
          owned_by_vax_role: false,
        },
      ]);
      expect(providerFunctions.every((item) => !item.security_definer)).toBe(
        true,
      );
    });

    it("keeps Data API, anonymous and PUBLIC-derived access at zero", async () => {
      const result = await admin.query<{
        role_name: string;
        table_privileges: number;
        sequence_privileges: number;
        policy_count: number;
        schema_usage: boolean;
        schema_create: boolean;
      }>(
        `
        select role_name,
          (select count(*)::integer from information_schema.role_table_grants
            where grantee = role_name and table_schema = 'public')
            as table_privileges,
          (select count(*)::integer
            from pg_class sequence
            join pg_namespace schema on schema.oid = sequence.relnamespace
            where schema.nspname = 'public' and sequence.relkind = 'S'
              and has_sequence_privilege(role_name, sequence.oid, 'USAGE'))
            as sequence_privileges,
          (select count(*)::integer from pg_policies policy
            where policy.schemaname = 'public'
              and role_name = any(policy.roles)) as policy_count,
          has_schema_privilege(role_name, 'public', 'USAGE') as schema_usage,
          has_schema_privilege(role_name, 'public', 'CREATE') as schema_create
        from unnest($1::text[]) role_name
        order by role_name
      `,
        [["anonymous", "authenticated"]],
      );
      expect(result.rows).toEqual([
        {
          role_name: "anonymous",
          table_privileges: 0,
          sequence_privileges: 0,
          policy_count: 0,
          schema_usage: true,
          schema_create: false,
        },
        {
          role_name: "authenticated",
          table_privileges: 0,
          sequence_privileges: 0,
          policy_count: 0,
          schema_usage: true,
          schema_create: false,
        },
      ]);

      const probe = `phase3k_public_probe_${randomBytes(6).toString("hex")}`;
      const adminRole = process.env.DATABASE_ADMIN_EXPECTED_ROLE!;
      await admin.query("BEGIN");
      try {
        await admin.query(`CREATE ROLE "${probe}" NOLOGIN`);
        await admin.query(`GRANT "${probe}" TO "${adminRole}"`);
        await admin.query(`SET LOCAL ROLE "${probe}"`);
        await expect(
          admin.query("select count(*) from public.services"),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await admin.query("ROLLBACK");
      }
      const residue = await admin.query<{ exists: boolean }>(
        "select exists(select 1 from pg_roles where rolname = $1) as exists",
        [probe],
      );
      expect(residue.rows[0]?.exists).toBe(false);
    });

    it("allows controlled migrator DDL with deny-by-default future objects and rolls it back", async () => {
      const migrator = new Client({ connectionString: migrationUrl });
      await migrator.connect();
      await migrator.query("BEGIN");
      try {
        await migrator.query(
          "create table public.phase3k_default_privilege_probe (id bigint generated always as identity primary key)",
        );
        await migrator.query(`
          create function public.phase3k_default_privilege_probe_fn()
          returns integer language sql as $$ select 1 $$
        `);
        const privileges = await migrator.query<{
          runtime_table: boolean;
          authenticated_table: boolean;
          anonymous_table: boolean;
          runtime_function: boolean;
          authenticated_function: boolean;
          anonymous_function: boolean;
          table_owner: string;
          function_owner: string;
        }>(`
          select
            has_table_privilege('vax_runtime',
              'public.phase3k_default_privilege_probe', 'SELECT')
              as runtime_table,
            has_table_privilege('authenticated',
              'public.phase3k_default_privilege_probe', 'SELECT')
              as authenticated_table,
            has_table_privilege('anonymous',
              'public.phase3k_default_privilege_probe', 'SELECT')
              as anonymous_table,
            has_function_privilege('vax_runtime',
              'public.phase3k_default_privilege_probe_fn()', 'EXECUTE')
              as runtime_function,
            has_function_privilege('authenticated',
              'public.phase3k_default_privilege_probe_fn()', 'EXECUTE')
              as authenticated_function,
            has_function_privilege('anonymous',
              'public.phase3k_default_privilege_probe_fn()', 'EXECUTE')
              as anonymous_function,
            (select owner.rolname
              from pg_class table_object
              join pg_roles owner on owner.oid = table_object.relowner
              where table_object.oid =
                'public.phase3k_default_privilege_probe'::regclass)
              as table_owner,
            pg_get_userbyid(function.proowner) as function_owner
          from pg_proc function
          join pg_namespace schema on schema.oid = function.pronamespace
          where schema.nspname = 'public'
            and function.proname = 'phase3k_default_privilege_probe_fn'
        `);
        expect(privileges.rows[0]).toMatchObject({
          runtime_table: false,
          authenticated_table: false,
          anonymous_table: false,
          runtime_function: false,
          authenticated_function: false,
          anonymous_function: false,
          table_owner: vaxDatabaseRoles.migrator,
          function_owner: vaxDatabaseRoles.migrator,
        });
      } finally {
        await migrator.query("ROLLBACK");
        await migrator.end();
      }
      const residue = await admin.query<{ table_exists: boolean }>(`
        select to_regclass('public.phase3k_default_privilege_probe') is not null
          as table_exists
      `);
      expect(residue.rows[0]?.table_exists).toBe(false);
    });

    it("denies runtime DDL, grants, role administration, trigger changes, system metadata and the migration ledger", async () => {
      const runtime = new Client({ connectionString: runtimeUrl });
      await runtime.connect();
      try {
        for (const statement of [
          "create table public.phase3k_runtime_forbidden (id integer)",
          "alter table public.services disable trigger all",
          "drop table public.services",
          "create role phase3k_runtime_forbidden_role",
          "update public.travel_zones set active = active where active = true",
          "update public.service_item_capabilities set service_id = service_id",
          "select * from public.system_metadata",
          "select * from drizzle.__drizzle_migrations",
          "select public.vax_finance_guard_invoice()",
        ]) {
          await expectDenied(runtime, statement);
        }

        await runtime.query("BEGIN");
        try {
          const lockedReference = await runtime.query(
            "select id from public.travel_zones where active = true limit 1 for share",
          );
          expect(lockedReference.rowCount).toBe(1);
          await runtime.query(
            "grant select on public.services to authenticated",
          );
          const grantEffect = await runtime.query<{ allowed: boolean }>(`
            select has_table_privilege(
              'authenticated', 'public.services', 'SELECT'
            ) as allowed
          `);
          expect(grantEffect.rows[0]?.allowed).toBe(false);
        } finally {
          await runtime.query("ROLLBACK");
        }
      } finally {
        await runtime.end();
      }
    });

    it("keeps insert-only delivery evidence usable without granting row reads", async () => {
      const runtime = new Client({ connectionString: runtimeUrl });
      await runtime.connect();
      try {
        await runtime.query("BEGIN");
        await expectDenied(
          runtime,
          "insert into public.delivery_attempts default values returning *",
        );
        await runtime.query("ROLLBACK");

        await runtime.query("BEGIN");
        await expect(
          runtime.query(
            "insert into public.delivery_attempts default values returning 1",
          ),
        ).rejects.toMatchObject({ code: "23502" });
      } finally {
        await runtime.query("ROLLBACK");
        await runtime.end();
      }
    });

    it("executes real low-privilege repository paths and rolls back every synthetic row", async () => {
      const client = new Client({ connectionString: runtimeUrl });
      await client.connect();
      await client.query("BEGIN");
      const database = addTransactionalBatch(
        nodePostgresDrizzle(client, { schema }),
      );
      const actorProfileId = randomUUID();
      const suffix = token();
      try {
        const referenceRead = await client.query(
          "select code from public.services where active = true limit 1",
        );
        expect(referenceRead.rowCount).toBe(1);

        await client.query(
          `insert into public.user_profiles (
             id, auth_provider_user_id, display_name, preferred_locale, status
           ) values ($1, $2, $3, 'en', 'ACTIVE')`,
          [actorProfileId, `phase3k-runtime-${suffix}`, "Phase 3K runtime"],
        );
        await client.query(
          `insert into public.user_roles (
             user_profile_id, role_id, active, assignment_source,
             assigned_by_profile_id
           ) select $1, id, true, 'OWNER_BOOTSTRAP', $1
             from public.application_roles where code = 'OWNER'`,
          [actorProfileId],
        );

        const customer = await createCustomerRecord(database, actorProfileId, {
          customerType: "INDIVIDUAL",
          displayName: `Phase 3K ${suffix}`,
          legalName: null,
          preferredLocale: "en",
          primaryEmail: null,
          primaryPhone: null,
          internalNotes: null,
        });
        expect(customer.status).toBe("CREATED");
        if (customer.status !== "CREATED") {
          throw new Error("Synthetic customer was not created.");
        }

        const publicRequest = await createPublicCodeRequestRecord(database, {
          requestReference: `REQ-${suffix}`,
          preferredLocale: "en",
          contactName: "Phase 3K runtime",
          contactEmail: "phase3k@example.invalid",
          contactPhone: null,
          customerNotes: null,
          preferredDate: null,
          preferredWindowCode: null,
          originalSubmission: { phase: "3K" },
          itemTypeCodes: ["SOFA_2_SEAT"],
          conditionLevelCode: "NORMAL",
          customerDescription: "Phase 3K rollback verification",
        });
        expect(publicRequest.status).toBe("CREATED");

        await client.query(
          `insert into public.customer_identity_links (
             user_profile_id, customer_id, relationship_type, active,
             created_by_profile_id
           ) values ($1, $2, 'OWNER', true, $1)`,
          [actorProfileId, customer.id],
        );
        await expect(
          updateOwnCommunicationPreferences(database, actorProfileId, {
            portalEnabled: true,
            emailFutureEnabled: false,
            smsFutureEnabled: false,
            operationalAllowed: true,
            billingAllowed: true,
            marketingConsent: false,
            preferredLocale: "en",
            expectedVersion: 0,
          }),
        ).resolves.toEqual({ status: "UPDATED", version: 1 });

        const missingId = randomUUID();
        const writePathResults = [
          await createQuoteDraftRecord(database, actorProfileId, {
            requestId: missingId,
            expectedRequestVersion: 1,
            quoteReference: `Q-${suffix}`,
            estimateId: randomUUID(),
            currency: "EUR",
            priceBasis: "NET",
            netAmountMinorUnits: 100,
            vatRateBasisPoints: 2000,
            vatAmountMinorUnits: 20,
            grossTotalMinorUnits: 120,
            estimatedDurationMinutes: 30,
            commercialSnapshot: {},
            termsSnapshot: {},
            validFrom: new Date("2026-08-27T00:00:00.000Z"),
            validUntil: new Date("2026-09-27T00:00:00.000Z"),
            staffNotes: null,
            customerNotes: null,
            items: [],
          }),
          await acceptQuoteRecord(database, actorProfileId, {
            quoteReference: `Q-${suffix}`,
            expectedQuoteVersion: 1,
            bookingReference: `BKG-${suffix}`,
            actorType: "STAFF_ON_BEHALF",
            acceptanceSource: "PHONE",
            acceptanceNote: "Phase 3K rollback verification",
          }),
          await createDatabaseSchedulingDispatchRepository(
            database,
          ).confirmSchedule(actorProfileId, {
            bookingReference: `BKG-${suffix}`,
            expectedBookingVersion: 1,
            workDate: "2026-08-27",
            candidateKey: "TEAM_A:2026-08-27:360:none:none:phase3k-runtime",
            expectedOccupancySnapshotVersion: null,
            reasonCategory: null,
            reasonText: null,
          }),
          await createJobFromBookingRecord(database, actorProfileId, {
            bookingReference: `BKG-${suffix}`,
            expectedBookingVersion: 1,
            jobReference: `JOB-${suffix}`,
          }),
          await createInvoiceDraftRecord(database, actorProfileId, {
            bookingReference: `BKG-${suffix}`,
            invoiceReference: `INV-${suffix}`,
            customerVisibleNote: null,
            internalNote: null,
            manualAdjustmentRequested: false,
            environmentScope: "DEVELOPMENT",
          }),
        ];
        expect(writePathResults).toHaveLength(5);
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }

      const residue = await admin.query<{ count: number }>(
        `select count(*)::integer as count from public.user_profiles
           where id = $1`,
        [actorProfileId],
      );
      expect(residue.rows[0]?.count).toBe(0);
    }, 30_000);
  },
);
