#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_PRIVATE_S3_URI:?Set a private s3://bucket/prefix destination}"
case "$BACKUP_PRIVATE_S3_URI" in s3://*) ;; *) printf '%s\n' 'Private S3 destination required' >&2; exit 1;; esac
: "${BACKUP_DIRECTORY:=./backups}"
mkdir -p "$BACKUP_DIRECTORY"
chmod 700 "$BACKUP_DIRECTORY"
backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIRECTORY/opti-x-$backup_stamp.dump"
# Configure PGSERVICE or PGDATABASE/PGHOST/PGUSER/PGPASSWORD in your secret store.
pg_dump --format=custom --no-owner --no-acl --file="$backup_file"
pg_restore --list "$backup_file" >/dev/null
sha256sum "$backup_file" > "$backup_file.sha256"
aws s3 cp "$backup_file" "$BACKUP_PRIVATE_S3_URI/" --sse AES256 --only-show-errors
aws s3 cp "$backup_file.sha256" "$BACKUP_PRIVATE_S3_URI/" --sse AES256 --only-show-errors
printf '%s\n' "Backup archive and checksum uploaded at $backup_stamp"
