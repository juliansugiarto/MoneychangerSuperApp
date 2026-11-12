#!/bin/sh
# Salinan cadangan kedua di luar VPS: tarik cadangan TERENKRIPSI terbaru dari VPS ke Mac, periksa sha256 kedua sisi,
# simpan 14 terbaru. Dijalankan launchd tiap hari (~/Library/LaunchAgents/com.solvinc.ibv-cadangan-tarik.plist);
# bila Mac tidur pada jamnya, launchd menjalankannya saat Mac bangun. Berkas tetap terenkripsi (AES-256); pembukanya
# BACKUP_CIPHER_PASS, yang TIDAK disimpan di sini.
set -eu
HOST=deploy@187.77.148.118
DIR="$HOME/Backups/ibukotavalasindo"
KEEP=14
mkdir -p "$DIR"
VPS='cd ~/moneychanger/deploy/vps && docker compose exec -T backup'
latest=$(ssh -o ConnectTimeout=20 -o BatchMode=yes "$HOST" "$VPS ls -1t /backups" | grep '\.sql\.zst\.enc$' | head -1)
[ -n "$latest" ] || { echo "$(date -u +%FT%TZ) GAGAL: tidak ada cadangan di VPS"; exit 1; }
if [ -s "$DIR/$latest" ]; then echo "$(date -u +%FT%TZ) sudah ada: $latest"; exit 0; fi
ssh -o BatchMode=yes "$HOST" "$VPS cat /backups/$latest" > "$DIR/$latest.part"
remote=$(ssh -o BatchMode=yes "$HOST" "$VPS sha256sum /backups/$latest" | cut -d' ' -f1)
local_sum=$(shasum -a 256 "$DIR/$latest.part" | cut -d' ' -f1)
if [ "$remote" != "$local_sum" ]; then rm -f "$DIR/$latest.part"; echo "$(date -u +%FT%TZ) GAGAL: sha256 berbeda untuk $latest"; exit 1; fi
mv "$DIR/$latest.part" "$DIR/$latest"
ls -1t "$DIR"/*.sql.zst.enc | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old"; done
echo "$(date -u +%FT%TZ) OK: $latest ($(wc -c < "$DIR/$latest" | tr -d ' ') byte, sha256 $local_sum)"
