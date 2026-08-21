<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository operating instructions

- Inspect the existing implementation before changing it. Preserve working
  behavior and avoid unrelated refactors.
- `main` is the protected stable branch. Normal implementation work uses an
  isolated worktree and a focused `codex/<phase>-<description>` branch created
  from current `main`. Never force-push.
- Read the relevant files in docs/ before changing architecture, domain
  behavior, security boundaries, data models, or visual direction.
- Work incrementally and keep this application a modular monolith.
- Use typed code, preserve strict TypeScript, and validate every trust boundary.
- Keep framework, database-provider, authentication-provider, and
  storage-provider details outside core business rules.
- Never commit secrets, credentials, API keys, .env, or .env.local files. Keep
  .env.example limited to variable names and empty values.
- Never access or modify production data unless the user explicitly instructs
  it.
- Use reviewed Drizzle migrations for every schema change. Inspect generated
  SQL, apply it only to the Neon `development` branch when authorized, and
  never alter Neon Auth-managed schemas unless a task explicitly requires it.
- Production migrations, destructive database work, and deployment always
  require separate explicit authorization.
- Add or update tests for important behavior and failure paths.
- Product UI must include appropriate loading, empty, and error states; be
  responsive and mobile-usable; and follow accessible UI practices.
- Record critical future business operations in audit logs.
- For requested implementation work, Codex should handle scoped commits,
  normal pushes, pull requests, CI inspection, and merge only after required
  checks pass. Do not publish Git changes for read-only tasks or when forbidden.
- Minimize routine terminal, Git, test, and development-database work for the
  user; ask only for decisions or authority that materially change scope.

## Completion standard

Run `npm run validate` before declaring implementation work complete. It runs
lint, typecheck, tests, build, migration-history validation, dependency audit,
and `git diff --check`. Use `npm ci` first for clean-install, dependency, or
lockfile validation.

Inspect git status, the final diff, and commit candidates for secrets. Report
failures honestly; never suppress or bypass failing checks or CI.
