#!/usr/bin/env bash
# Membuktikan cadangan TERBARU di volume lokal dapat dipulihkan: dekripsi → muat ke MySQL kosong (restore-check, tmpfs)
# → bandingkan jumlah tabel, migrasi, dan baris tabel inti dengan basis data live. Tidak pernah menulis ke data live.
#   ./restore-test.sh                (gladi lokal: COMPOSE_FILE=compose.yaml:compose.local.yaml ./restore-test.sh)
set -euo pipefail
cd "$(dirname "$0")"
latest=$(docker compose exec -T backup sh -c 'ls -1t /backups/moneychanger-*.sql.zst.enc 2>/dev/null | head -1')
[ -n "$latest" ] || { echo "Belum ada cadangan. Jalankan: docker compose exec backup backup.sh"; exit 1; }
echo "[uji-pulih] berkas: $latest"
docker compose --profile ops up -d restore-check >/dev/null
for _ in $(seq 1 60); do
  # Lewat TCP: server sementara milik entrypoint (inisialisasi) hanya membuka soket, jadi ping soket bisa lolos terlalu dini.
  docker compose exec -T restore-check mysqladmin ping -h 127.0.0.1 -uroot -prestore-check-only --silent >/dev/null 2>&1 && break
  sleep 2
done
docker compose exec -T backup sh -c "openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_CIPHER_PASS -in '$latest' | zstd -dc" \
  | docker compose exec -T restore-check mysql -uroot -prestore-check-only
count() { # $1 = layanan, $2 = sandi (env di kontainer), $3 = SQL
  docker compose exec -T "$1" sh -c "mysql -uroot -p\"\$$2\" -N -e \"$3\" moneychanger 2>/dev/null"
}
sql_tables="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='moneychanger'"
echo "[uji-pulih] tabel        live=$(count mysql MYSQL_ROOT_PASSWORD "$sql_tables")  pulih=$(count restore-check MYSQL_ROOT_PASSWORD "$sql_tables")"
for table in __drizzle_migrations users customers exchange_transactions cash_balances journal_entries audit_logs; do
  sql="SELECT COUNT(*) FROM $table"
  echo "[uji-pulih] $(printf '%-22s' "$table") live=$(count mysql MYSQL_ROOT_PASSWORD "$sql")  pulih=$(count restore-check MYSQL_ROOT_PASSWORD "$sql")"
done
docker compose --profile ops rm -sf restore-check >/dev/null
echo "[uji-pulih] selesai. Baris yang ditulis sesudah jam cadangan wajar lebih banyak di live."
