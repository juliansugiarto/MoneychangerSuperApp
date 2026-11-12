#!/bin/bash
# Menunggu sampai 18.00 UTC (01.00 WIB) lalu menjalankan backup.sh, setiap hari. Kegagalan dicatat ke log kontainer
# (docker compose logs backup) dan tidak menghentikan loop.
set -u
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today 18:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow 18:00" +%s)
  sleep $((next - now))
  /usr/local/bin/backup.sh || echo "[cadangan] GAGAL $(date -u +%FT%TZ)"
done
