#!/bin/bash
# Satu cadangan terenkripsi basis data `moneychanger`. Dijalankan loop.sh tiap hari, atau manual:
#   docker compose exec backup backup.sh
set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/backups/moneychanger-${stamp}.sql.zst.enc"
# --single-transaction --set-gtid-purged=OFF: konsisten tanpa mengunci, dan dapat dipulihkan (ERROR 3546 tanpa opsi kedua).
mysqldump -h "${MYSQL_HOST}" -uroot --single-transaction --set-gtid-purged=OFF --routines --triggers --events \
  --hex-blob --default-character-set=utf8mb4 --databases moneychanger \
  | zstd -q -T0 -10 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_CIPHER_PASS -out "${file}.part"
mv "${file}.part" "${file}"
echo "[cadangan] ${stamp} $(du -h "${file}" | cut -f1) ${file}"
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy --s3-no-check-bucket "${file}" "${BACKUP_REMOTE}" && echo "[cadangan] terkirim ke ${BACKUP_REMOTE}"
fi
# Simpan N terbaru di volume lokal; masa simpan di R2 diatur aturan siklus hidup bucket (docs/deployment/vps.md).
ls -1t /backups/moneychanger-*.sql.zst.enc | tail -n +$((BACKUP_KEEP_LOCAL + 1)) | xargs -r rm -f
