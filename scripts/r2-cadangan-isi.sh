#!/bin/sh
# Mengisi kunci R2 cadangan (token "ibv-vps-backup") ke .env VPS, lalu membuktikan satu cadangan terkirim ke R2.
# Dijalankan PEMILIK di Terminal Mac (bukan oleh Claude): kunci rahasia diketik tersembunyi, dikirim lewat stdin SSH,
# tidak pernah muncul di layar, riwayat shell, maupun daftar proses.
#   sh scripts/r2-cadangan-isi.sh
set -eu
HOST=deploy@187.77.148.118
printf "Access Key ID (token ibv-vps-backup): "; stty -echo; read -r KEY_ID; stty echo; echo
printf "Secret Access Key: "; stty -echo; read -r SECRET; stty echo; echo
[ -n "$KEY_ID" ] && [ -n "$SECRET" ] || { echo "Kosong. Batal."; exit 1; }
printf '%s\n%s\n' "$KEY_ID" "$SECRET" | ssh "$HOST" 'set -eu
cd ~/moneychanger/deploy/vps
IFS= read -r KEY_ID; IFS= read -r SECRET
cp .env .env.bak-r2-keys
# Ganti baris yang ada tanpa sed (rahasia bisa berisi karakter khusus).
awk -v k="$KEY_ID" -v s="$SECRET" '"'"'
  /^BACKUP_R2_ACCESS_KEY_ID=/ { print "BACKUP_R2_ACCESS_KEY_ID=" k; next }
  /^BACKUP_R2_SECRET_ACCESS_KEY=/ { print "BACKUP_R2_SECRET_ACCESS_KEY=" s; next }
  { print }'"'"' .env.bak-r2-keys > .env
grep -q "^BACKUP_REMOTE=r2:ibv-backup" .env || { echo "BACKUP_REMOTE belum r2:ibv-backup"; exit 1; }
docker compose up -d --force-recreate backup >/dev/null 2>&1
sleep 3
docker compose exec -T backup backup.sh
echo "-- isi bucket ibv-backup:"
docker compose exec -T backup rclone lsl --s3-no-check-bucket r2:ibv-backup | tail -3'
echo "Baris '[cadangan] terkirim ke r2:ibv-backup' di atas = cadangan di luar VPS berjalan."

# Kata sandi pembuka cadangan disalin ke Keychain Mac (layanan "IBV cadangan", akun "BACKUP_CIPHER_PASS").
# Tanpa salinan di luar VPS, cadangan di R2 pun tidak bisa dibuka bila VPS hilang.
PASS=$(ssh "$HOST" 'grep "^BACKUP_CIPHER_PASS=" ~/moneychanger/deploy/vps/.env | cut -d= -f2-')
[ -n "$PASS" ] || { echo "BACKUP_CIPHER_PASS tidak ditemukan di VPS."; exit 1; }
security add-generic-password -U -s "IBV cadangan" -a "BACKUP_CIPHER_PASS" -w "$PASS"
unset PASS
security find-generic-password -s "IBV cadangan" -a "BACKUP_CIPHER_PASS" >/dev/null && echo "Kata sandi cadangan tersimpan di Keychain (Akses Rantai Kunci → cari 'IBV cadangan')."
