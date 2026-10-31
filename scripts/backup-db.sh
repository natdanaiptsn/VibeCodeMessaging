#!/usr/bin/env bash
# สำรองฐานข้อมูล PostgreSQL (รูปแบบ custom, บีบอัด) และลบไฟล์ที่เก่ากว่า RETENTION_DAYS
# ใช้งาน (docker compose):  ./scripts/backup-db.sh
# ใช้งาน (เครื่องที่มี pg_dump): DATABASE_URL=postgresql://... ./scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="lineoa-${STAMP}.dump"
mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --no-owner --dbname="${DATABASE_URL%%\?*}" --file="${BACKUP_DIR}/${FILE}"
else
  # ใช้ container "db" ของ docker compose (โฟลเดอร์ ./backups ถูก mount ไว้ที่ /backups)
  docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "/backups/'"${FILE}"'"'
fi

echo "✓ สำรองข้อมูลแล้ว: ${BACKUP_DIR}/${FILE}"
find "$BACKUP_DIR" -name 'lineoa-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete || true
