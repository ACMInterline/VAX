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

Neon supports standard PostgreSQL logical export tools. A compatible `pg_dump`
and `pg_restore` client was not installed in this workspace, so Phase 3L did
not claim or simulate a portable export. Before production, install an approved
matching client outside the application dependency tree and prove:

- encrypted direct migrator/read-only connection with verify-full;
- schema plus required data export to encrypted restricted storage;
- no connection string, role password or Auth token embedded in the artifact;
- `pg_restore --list` and a disposable restore verification;
- retention, deletion, access logging and off-provider storage ownership; and
- restoration of sequences, constraints, functions, RLS, grants and migration
  history.

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
