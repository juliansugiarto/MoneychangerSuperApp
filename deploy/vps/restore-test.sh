#!/usr/bin/env bash
# Membuktikan cadangan TERBARU di volume lokal dapat dipulihkan: dekripsi → muat ke MySQL kosong (restore-check, tmpfs)
# → bandingkan dengan basis data live. GAGAL (exit 1) bila jumlah tabel atau migrasi berbeda, atau tabel inti tidak
# terbaca / berisi lebih banyak dari live. Tidak pernah menulis ke data live; kontainer uji selalu dihapus.
#   ./restore-test.sh                (gladi lokal: COMPOSE_FILE=compose.yaml:compose.local.yaml ./restore-test.sh)
set -euo pipefail
cd "$(dirname "$0")"
cleanup() { docker compose --profile ops rm -sf restore-check >/dev/null 2>&1 || true; }
trap cleanup EXIT
latest=$(docker compose exec -T backup sh -c 'ls -1t /backups/moneychanger-*.sql.zst.enc 2>/dev/null | head -1')
[ -n "$latest" ] || { echo "Belum ada cadangan. Jalankan: docker compose exec backup backup.sh"; exit 1; }
echo "[uji-pulih] berkas: $latest"
docker compose --profile ops up -d --force-recreate restore-check >/dev/null
for _ in $(seq 1 60); do
  # Lewat TCP: server sementara milik entrypoint (inisialisasi) hanya membuka soket, jadi ping soket bisa lolos terlalu dini.
  docker compose exec -T restore-check sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqladmin ping -h 127.0.0.1 -uroot --silent' >/dev/null 2>&1 && break
  sleep 2
done
docker compose exec -T backup sh -c "openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_CIPHER_PASS -in '$latest' | zstd -dc" \
  | docker compose exec -T restore-check sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
count() { # $1 = layanan, $2 = SQL; mencetak angka atau gagal
  docker compose exec -T "$1" sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot -N -e \"$2\" moneychanger"
}
failed=0
check() { # $1 = label, $2 = SQL, $3 = sama|maks
  local live restored
  live=$(count mysql "$2") || live=""
  restored=$(count restore-check "$2") || restored=""
  local verdict=ok
  if ! [[ "$live" =~ ^[0-9]+$ && "$restored" =~ ^[0-9]+$ ]]; then verdict=GAGAL
  elif [ "$3" = sama ] && [ "$live" != "$restored" ]; then verdict=GAGAL
  elif [ "$3" = maks ] && [ "$restored" -gt "$live" ]; then verdict=GAGAL
  fi
  [ "$verdict" = ok ] || failed=1
  echo "[uji-pulih] $(printf '%-22s' "$1") live=${live:-?}  pulih=${restored:-?}  $verdict"
}
check tabel "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='moneychanger'" sama
check __drizzle_migrations "SELECT COUNT(*) FROM __drizzle_migrations" sama
for table in users customers exchange_transactions cash_balances journal_entries audit_logs; do
  check "$table" "SELECT COUNT(*) FROM $table" maks
done
[ "$failed" = 0 ] || { echo "[uji-pulih] GAGAL: cadangan tidak pulih utuh."; exit 1; }
echo "[uji-pulih] LULUS. Baris yang ditulis sesudah jam cadangan wajar lebih banyak di live."
