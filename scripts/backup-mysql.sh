#!/usr/bin/env bash
# Noēsis MySQL backup — W-D1 (Substrate Trust).
#
# mysqldump of the Grid DB from the docker mysql container, gzip'd to a dated
# file under BACKUP_DIR, pruned after RETENTION_DAYS, optionally copied to S3.
#
# This script is for the OPERATOR to install as cron on the prod host — it is
# never run by CI or by deploy tooling. Runbook (cron line, restore procedure,
# RPO/RTO): .planning/implementation/backups.md
#
# Env (all optional except the password):
#   MYSQL_ROOT_PASSWORD  required — root password of the mysql container
#                        (same value as the compose .env)
#   MYSQL_CONTAINER      docker container name        (default: noesis-mysql)
#   MYSQL_DATABASE       database to dump             (default: noesis_grid)
#   MYSQL_BACKUP_USER    mysql user for the dump      (default: root)
#   BACKUP_DIR           where dumps land             (default: /home/ec2-user/backups)
#   RETENTION_DAYS       local prune horizon          (default: 14)
#   S3_BUCKET            if set, also `aws s3 cp` the dump to this bucket
set -euo pipefail

MYSQL_CONTAINER="${MYSQL_CONTAINER:-noesis-mysql}"
MYSQL_DATABASE="${MYSQL_DATABASE:-noesis_grid}"
MYSQL_BACKUP_USER="${MYSQL_BACKUP_USER:-root}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?set MYSQL_ROOT_PASSWORD (same value as the compose .env)}"
BACKUP_DIR="${BACKUP_DIR:-/home/ec2-user/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_BUCKET="${S3_BUCKET:-}"

mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
outfile="$BACKUP_DIR/${MYSQL_DATABASE}-${stamp}.sql.gz"

# --single-transaction: consistent InnoDB snapshot without locking the live Grid.
# MYSQL_PWD is passed as container env so the password never appears in `ps`.
docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$MYSQL_CONTAINER" \
    mysqldump --single-transaction --quick --routines --triggers \
    -u"$MYSQL_BACKUP_USER" "$MYSQL_DATABASE" | gzip > "$outfile"

# Belt-and-braces: refuse to keep a zero-byte dump.
if [ ! -s "$outfile" ]; then
    echo "backup-mysql: FAIL — empty dump $outfile" >&2
    rm -f "$outfile"
    exit 1
fi
echo "backup-mysql: wrote $outfile ($(du -h "$outfile" | cut -f1))"

# Prune local backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -name "${MYSQL_DATABASE}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

# Optional off-host copy (RPO survives loss of the EC2 volume).
if [ -n "$S3_BUCKET" ]; then
    aws s3 cp "$outfile" "s3://${S3_BUCKET}/mysql-backups/$(basename "$outfile")"
    echo "backup-mysql: uploaded to s3://${S3_BUCKET}/mysql-backups/"
fi
