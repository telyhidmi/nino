# Database migrations

The existing development database was inspected before changes: its public
schema had no tables. The posts schema was applied using the repository's
existing command, `pnpm --filter @workspace/db run push`.

This project uses Replit-managed PostgreSQL. Production schema changes are
applied by Replit's **Publish** flow: it compares the development schema with
production, asks for confirmation of any renames, and applies the schema diff.
Re-publish after verifying schema changes in development. Do not manually
target production using `DATABASE_URL`, run production DDL, or add migration
commands to deployment builds or application startup.

The schema source of truth is `lib/db/src/schema`. For future changes, edit
that schema and let the repository's development setup/post-merge flow apply
it to the development database. The existing `push` command is for development
only. Review any rename/destructive-change prompts in the Publish UI.

The initial SQL snapshot and metadata in `lib/db/drizzle` were generated and
baselined in development. They are for development review/history, not a
production migration mechanism. Optional `generate`/`migrate` commands must
only operate on development; no manual production migration is required.

Post IDs equal upload-ticket IDs. Upload records must retain their
`finalized_at` tombstones after deletion to prevent replay and resurrection.
Expired unpublished uploads remain private and cannot be finalized. Configure
a storage lifecycle policy for the `nino/uploads/` staging prefix (retain at
least 24 hours) to reclaim abandoned uploads. Never expire the
`nino/published/` prefix: published media must persist until owner deletion.