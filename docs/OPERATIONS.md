# Operations, backup and recovery

## Daily database backup

`scripts/backup.sh` uses `pg_dump --format=custom`, verifies the archive with `pg_restore --list`, then uploads it to a configured **private** S3-compatible destination using the AWS CLI. It refuses an empty destination. It does not print database URLs or credentials. The destination must have encryption, restricted IAM access, private access and a lifecycle policy. Use a secret store for `PGDATABASE` / `PGSERVICE` and cloud credentials. PostgreSQL client tools must match or exceed the server major version.

Schedule the script daily on your server, for example at 02:00 IST with a systemd timer or scheduler configured to Asia/Kolkata. This project does not create a live external schedule. Store success timestamps and alert if the most recent verified backup is older than 26 hours. Keep local backup permissions at 0700/0600, and remove old local copies only after verified uploads and according to your retention policy.

Supabase Storage object bytes are not inside a database dump. Back up the `lens-images` and `shop-assets` object bytes separately to a private destination, with version metadata and manifests. Do not rely on database object metadata as an image backup.

## Point-in-time recovery

Enable the appropriate Supabase paid plan/PITR add-on for the required recovery window and confirm what it covers. Check current plan capabilities in Supabase before purchasing. PITR complements independent backups; it does not restore lost Storage bytes by itself.

## Restore drill

At least quarterly, and after significant schema changes:

1. Create an isolated recovery project with the same Postgres major version and migrations. Restrict network and user access; never overwrite production for a drill.
2. Review the dump manifest with `pg_restore --list`; note its timestamp, checksum and archive schema contents.
3. Restore to the disposable target using `pg_restore --no-owner --no-acl`. Supabase-managed schemas/roles may need a platform-supported backup/restore procedure; validate Auth identity mappings before data import. Do not blindly replace the platform's managed roles.
4. Restore Storage bytes using the matching private object backup and verify object counts/checksums. Reconcile uploaded object keys against `uploads` and frozen shop branding paths.
5. Run migration checks, RLS tests with two separate shops, invoice/payment reconciliation, latest invoice counter verification and representative PDF rendering.
6. Record achieved recovery point and recovery duration. Destroy the disposable recovery project through your approved process after the drill; do not copy recovered patient data into logs.

## Storage erasure worker

The erasure transaction anonymises customer contact fields, deletes prescription rows and clinical snapshots, clears order notes and queues image keys. Accounting invoice identities remain immutable. A request is `processing` until Storage API deletion succeeds. Completion is never inferred from deleting metadata.

Call `POST /api/maintenance` with `Authorization: Bearer <CRON_SECRET>` on a short recurring interval from a private scheduler. `scripts/process-deletions.mjs` does this and reports only counts. It handles up to 100 queued objects per call. Schedule subsequent calls until the backlog clears. Failed objects stay pending and are retried. Alert on old pending items and inspect infrastructure errors without logging image URLs or patient details.

A replacement lens photo queues the previous image for deletion. Branding images referenced by old invoice snapshots are retained. If a process dies between uploading an object and registering its metadata, it may leave an unreferenced object. A periodic owner-admin reconciliation should identify objects absent from both `uploads` and invoice branding references, verify their age and use before deleting them through Storage API. No unsafe wildcard deletion is supplied.

## Monthly archives and retention review

An owner can export each report section as CSV. Values are paise and CSV cells are escaped against spreadsheet formula execution. Archive daily sales, HSN/rate totals, payment modes, dues ageing, top products and staff sales in a private monthly folder with a checksum and reporting period. Exports are audit logged. A CSV is an analysis archive, not a substitute for the full relational database and immutable documents.

The settings record financial and clinical retention policies. Financial records are never automatically purged. Review clinical retention and open requests monthly, check outstanding balances and legal holds, and process verified erasure requests through the owner workflow. Consent/audit metadata is minimised; financial snapshots omit phone, date of birth, email and prescription data.

## Migration rollback

Take and verify a backup before migration. Prefer forward corrective migrations. Financial immutable rows and audit history must not be rewritten to make an old release appear compatible. Keep previous app builds, but roll back application code only if it is compatible with the migrated schema. For an irreversible schema problem, restore the verified backup to a new isolated project, reconcile transactions since the restore point and deliberately switch traffic. Never decrement counters or recycle issued invoice numbers.
