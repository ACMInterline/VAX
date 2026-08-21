<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository operating instructions

- Inspect the existing implementation before changing it. Preserve working
  behavior and avoid unrelated refactors.
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
- Never perform a destructive database change without an explicit, reviewable
  migration. Use migrations for every schema change.
- Add or update tests for important behavior and failure paths.
- Product UI must include appropriate loading, empty, and error states; be
  responsive and mobile-usable; and follow accessible UI practices.
- Record critical future business operations in audit logs.
- Do not commit, push, deploy, or change external services unless explicitly
  requested.

## Completion standard

Run the applicable repository checks before declaring work complete:

1. npm run lint
2. npm run typecheck
3. npm run test
4. npm run build
5. git diff --check

Inspect git status and the final diff. Report failures honestly; do not claim
completion while a required check is failing.
