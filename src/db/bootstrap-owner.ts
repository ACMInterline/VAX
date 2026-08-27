import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "./client";
import {
  assertDevelopmentDatabaseIdentity,
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";
import {
  applicationRoles,
  authAuditEvents,
  userProfiles,
  userRoles,
} from "./schema/identity-access";
import { ownerBootstrapDecision } from "@/modules/identity-access/bootstrap-policy";

loadMigrationEnvironment();
assertDevelopmentDatabaseMutationTarget();

async function bootstrapOwner(): Promise<"assigned" | "already-owner"> {
  const providerUserId = process.env.AUTH_BOOTSTRAP_PROVIDER_USER_ID?.trim();
  if (!providerUserId) {
    throw new Error("AUTH_BOOTSTRAP_PROVIDER_USER_ID is not configured.");
  }

  const database = getDatabase();
  await assertDevelopmentDatabaseIdentity(database, "runtime");
  const [target] = await database
    .select({ id: userProfiles.id, status: userProfiles.status })
    .from(userProfiles)
    .where(eq(userProfiles.authProviderUserId, providerUserId))
    .limit(1);

  if (!target || target.status !== "ACTIVE") {
    throw new Error("The bootstrap identity does not have an active application profile.");
  }

  const [ownerRole] = await database
    .select({ id: applicationRoles.id })
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.code, "OWNER"),
        eq(applicationRoles.active, true),
      ),
    )
    .limit(1);

  if (!ownerRole) {
    throw new Error("The canonical owner role is unavailable.");
  }

  const correlationId = randomUUID();
  await database.batch([
    database.execute(sql`select pg_advisory_xact_lock(hashtext('vax-owner-bootstrap'))`),
    database.execute(sql`
      with inserted_assignment as (
        insert into ${userRoles} (
          user_profile_id,
          role_id,
          active,
          assignment_source,
          assigned_at,
          assigned_by_profile_id,
          revoked_at,
          revoked_by_profile_id
        )
        select
          ${target.id},
          ${ownerRole.id},
          true,
          'OWNER_BOOTSTRAP',
          now(),
          null,
          null,
          null
        where not exists (
          select 1 from ${userRoles} existing_owner
          where existing_owner.role_id = ${ownerRole.id}
        )
        on conflict (user_profile_id, role_id) do nothing
        returning user_profile_id
      )
      insert into ${authAuditEvents} (
        id,
        event_type,
        outcome,
        actor_profile_id,
        subject_profile_id,
        correlation_id,
        safe_metadata,
        occurred_at
      )
      select
        gen_random_uuid(),
        'OWNER_BOOTSTRAPPED',
        'SUCCESS',
        null,
        user_profile_id,
        ${correlationId}::uuid,
        '{"roleCode":"OWNER"}'::jsonb,
        now()
      from inserted_assignment
    `),
  ]);

  const [createdEvent] = await database
    .select({ id: authAuditEvents.id })
    .from(authAuditEvents)
    .where(eq(authAuditEvents.correlationId, correlationId))
    .limit(1);
  if (createdEvent) {
    return "assigned";
  }

  const ownerAssignments = await database
    .select({ profileId: userRoles.userProfileId, active: userRoles.active })
    .from(userRoles)
    .where(eq(userRoles.roleId, ownerRole.id));
  const decision = ownerBootstrapDecision(ownerAssignments, target.id);
  if (decision === "ALREADY_OWNER") {
    return "already-owner";
  }
  throw new Error("Application ownership is already established; bootstrap is disabled.");
}

bootstrapOwner()
  .then((result) => {
    process.stdout.write(
      result === "assigned"
        ? "Initial application owner assigned.\n"
        : "The selected application profile is already an owner.\n",
    );
  })
  .catch(() => {
    process.stderr.write("Owner bootstrap failed safely.\n");
    process.exitCode = 1;
  });
