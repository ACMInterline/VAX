# Backup and Recovery

## Current capability

The current Neon project retains branch history for six hours. Neon documents
instant restore/time-travel within the configured history window. Its snapshot
system is Beta and plan/root-branch limits apply. A branch is an isolated copy,
not an independent off-provider backup.

Phase 3L did not alter the restore window, create a production snapshot or
restore any persistent branch in place.

## Completed rehearsal

On staging only, Phase 3L:

1. inserted one clearly synthetic recovery marker;
2. created a disposable child branch from the current staging state;
3. verified the marker, 98-table schema, 16-entry migration ledger and
   five-role/28-permission/76-mapping canonical RBAC state;
4. deleted the recovery branch; and
5. deleted and reverified removal of the marker.

A separate fixed-name temporary staging database was rebuilt from repository
migrations and canonical seeds. A controlled transactional DDL failure left no
table residue and did not change the 16-entry migration ledger. The temporary
database was then removed and absence reverified.

No customer, payment, bank, address, Auth user or production data was used.

Phase 3M added a portable recovery rehearsal with PostgreSQL 18 clients. A
custom-format export included both the VAX `public` schema and the `drizzle`
migration ledger from Neon staging. The artifact metadata and exact configured
runtime/migrator/Auth/application secret values were scanned with no match. A
clean database on a disposable Neon child branch was prepared with the managed
`btree_gist` extension, then restored without ownership or privilege replay.

The restored target matched 98 public tables, one Drizzle table, all 16 ordered
migration hashes, five roles, 28 permissions, 76 mappings and representative
synthetic profile/customer/property/asset/request/quote/Booking fingerprints.
All constraints remained validated. PostgreSQL normalized equivalent cast text
when deparsing some checks/exclusion indexes; table/column/trigger fingerprints,
object inventories, ledger hashes and data fingerprints matched. The recovery
branch/database and local dump artifacts were deleted after verification.

Measured staging observations, not production SLAs: the complete portable dump
took about 22 seconds and the final clean restore about 98 seconds. The first
restore attempt also documented two required runbook preconditions: restore to
an empty schema so foreign keys replay in native order, and install the managed
`btree_gist` extension before restoring exclusion constraints.

Those 98-table/16-entry figures are the historical Phase 3M portable-restore
snapshot. Phase 3N migration 0016 extends the current development/staging
contract to 100 public tables and 17 ordered migrations without seeding an
authority value. Current security/state verification must include both new
authority tables, their graph triggers/RLS/grants and the unchanged canonical
five-role/28-permission/76-mapping state. The Phase 3M artifact must not be
misreported as a portable restore rehearsal of the later 100-table contract;
the next approved export/restore exercise must verify the 0016 delta explicitly.

## Recovery procedure

For a future incident:

1. stop writes or mark readiness not-ready;
2. record the affected branch, reviewed commit, migration ledger and incident
   time without copying secrets into the incident channel;
3. choose a point within the provider history window;
4. create a recovery/preview branch—never overwrite the active branch first;
5. verify application table inventory, migration hashes, RBAC/reference state,
   business invariants and Auth branch state;
6. rehearse the exact application version against the recovery branch;
7. obtain owner/change approval before any in-place restore or endpoint move;
8. validate service/readiness and reconcile writes after recovery; and
9. delete disposable branches only after evidence is retained safely.

An in-place snapshot restore can change branch identity even when a connection
string remains stable. Re-read the live identity and update every exact branch
guard after an approved restore. Never assume a stored branch identifier
survives.

## Portable export

Neon supports standard PostgreSQL logical export tools. Phase 3M used a
containerized PostgreSQL 18 client matching the Neon server major version; it
did not add an application dependency. Future controlled exports must retain:

- encrypted direct migrator/read-only connection with verify-full;
- schema plus required data export to encrypted restricted storage;
- no connection string, role password or Auth token embedded in the artifact;
- `pg_restore --list` and a disposable restore verification;
- retention, deletion, access logging and off-provider storage ownership; and
- restoration of sequences, constraints, functions, RLS, grants and migration
  history; and
- explicit installation of provider-managed extension prerequisites before a
  clean restore.

## Objectives for owner approval

These are proposals, not contractual SLAs:

- RPO: no more than 24 hours for the initial small-business operation; and
- RTO: restore core authenticated operations within several hours.

The six-hour provider history is helpful but does not by itself approve these
targets. Backup frequency, export retention, monitoring, staff availability and
restore time must be measured before approval.

## Staging reset

Prefer recreating staging from the controlled release base, rotating staging
role/Auth/application secrets, applying reviewed migrations/seeds and rerunning
security/state/browser checks. Fixtures must be deterministic and synthetic.
Do not turn deletion of append-only business evidence into a general reset
operation, and never reuse this procedure against production without separate
authorization.
