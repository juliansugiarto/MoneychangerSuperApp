#!/usr/bin/env bash
# Membuat deploy/vps/.env dari .env.example (bila belum ada) dan mengisi rahasia yang masih kosong dengan nilai acak
# heksadesimal. Tidak pernah mengganti nilai yang sudah terisi dan tidak mencetak rahasia apa pun.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo "[init-env] .env dibuat dari .env.example"; }
chmod 600 .env
for key in MYSQL_ROOT_PASSWORD DB_APP_PASSWORD JWT_SECRET CRON_SECRET BACKUP_CIPHER_PASS; do
  if grep -qE "^${key}=$" .env; then
    value=$(openssl rand -hex 32)
    sed -i.bak "s/^${key}=$/${key}=${value}/" .env && rm -f .env.bak
    echo "[init-env] ${key} dibuat"
  fi
done
echo "[init-env] selesai. Isi manual: APP_VERSION, R2_* dan BACKUP_* (lihat docs/deployment/vps.md)."
