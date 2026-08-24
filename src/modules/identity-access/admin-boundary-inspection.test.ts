import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("identity administration trust boundaries", () => {
  it("authorizes the route and every mutation on the server", async () => {
    const [layout, actions] = await Promise.all([
      source("src/app/(application)/app/admin/layout.tsx"),
      source("src/app/(application)/app/admin/users/actions.ts"),
    ]);

    expect(layout).toContain("requireIdentityAdminPrincipal");
    expect(actions).toContain('requireUserPermission("USER_ADMIN_MANAGE")');
    expect(actions).toContain('isAuthAttemptAllowed("ADMIN_MUTATION"');
    expect(actions).toContain("z.enum(applicationRoleCodes)");
    expect(actions).toContain("z.enum(accountStatuses)");
    expect(actions).toContain("authenticatedAt: null");
  });

  it("uses application profile identifiers at the route boundary", async () => {
    const detail = await source(
      "src/app/(application)/app/admin/users/[id]/page.tsx",
    );

    expect(detail).toContain("z.uuid()");
    expect(detail).toContain("loadAdminUserDetail");
    expect(detail).not.toContain("authProviderUserId");
    expect(detail).not.toContain("providerUserId");
  });

  it("keeps role/status changes atomic with audit and last-owner locking", async () => {
    const repository = await source(
      "src/modules/identity-access/admin-repository.ts",
    );

    expect(repository).toContain("pg_advisory_xact_lock");
    expect(repository).toContain("database.batch");
    expect(repository).toContain("executeLockedAdminMutation");
    expect(repository).toContain("LAST_OWNER_PROTECTED");
    expect(repository).toContain("ROLE_ASSIGNED");
    expect(repository).toContain("ROLE_REMOVED");
    expect(repository).toContain("ACCOUNT_STATUS_CHANGED");
    expect(repository).toContain("PRIVILEGED_ADMINISTRATION");
    expect(repository).not.toContain("neon_auth");
  });

  it("keeps session operations unavailable instead of using provider tables", async () => {
    const [provider, detail] = await Promise.all([
      source("src/auth/neon-provider.ts"),
      source("src/app/(application)/app/admin/users/[id]/page.tsx"),
    ]);

    expect(provider).not.toContain(".admin.listUserSessions");
    expect(provider).not.toContain(".admin.revokeUserSessions");
    expect(detail).toContain("sessionUnavailable");
  });
});
