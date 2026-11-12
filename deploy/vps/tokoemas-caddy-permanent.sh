#!/bin/sh
# Membuat situs money changer PERMANEN di Caddy tokoemas (docs/deployment/vps.md, langkah 4). Jalankan SESUDAH toko emas
# dan outlet valas tutup: Caddy dibuat ulang, ibkshop.com dan situs ini terputus beberapa detik.
# Aman diulang. Bila sesudahnya ada situs yang tidak 200, semuanya dikembalikan otomatis ke cara sementara lama.
set -u
cd /opt/tokoemas/deploy/vps
check() {
  ok=0
  for u in https://ibkshop.com/ https://ibukotavalasindo.online/ https://backoffice.ibukotavalasindo.online/login; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$u"); echo "  $u $code"; [ "$code" = 200 ] || ok=1
  done
  return $ok
}
echo "== $(date -u +%FT%TZ) sebelum"; check || { echo "BATAL: ada situs yang sudah tidak 200 sebelum mulai."; exit 1; }
if grep -q "^COMPOSE_FILE=.*compose.mc-edge.yaml" .env; then echo "Sudah permanen; tidak ada yang diubah."; exit 0; fi
cp ~/moneychanger/deploy/vps/tokoemas-caddy-override.yaml compose.mc-edge.yaml
docker exec tokoemas-caddy-1 caddy validate --config /etc/caddy/certs/Caddyfile.mc --adapter caddyfile >/dev/null 2>&1 || { echo "BATAL: Caddyfile.mc tidak valid."; exit 1; }
cp .env .env.bak-mc-edge
sed -i "s#^COMPOSE_FILE=compose.yaml:compose.cloudflare.yaml\$#COMPOSE_FILE=compose.yaml:compose.cloudflare.yaml:compose.mc-edge.yaml#" .env
grep -q "^COMPOSE_FILE=.*compose.mc-edge.yaml" .env || { cp .env.bak-mc-edge .env; echo "BATAL: baris COMPOSE_FILE tidak seperti yang diharapkan."; exit 1; }
docker compose up -d --force-recreate caddy
sleep 10
echo "== sesudah"
if check; then echo "LULUS: situs money changer kini permanen di Caddy tokoemas."; exit 0; fi
echo "GAGAL: mengembalikan ke cara sementara lama"
cp .env.bak-mc-edge .env
docker compose up -d --force-recreate caddy
sleep 8
docker network connect --ip 172.30.0.254 mc_edge tokoemas-caddy-1 2>/dev/null || true
docker exec tokoemas-caddy-1 caddy reload --config /etc/caddy/certs/Caddyfile.mc --adapter caddyfile
sleep 3; echo "== sesudah pemulihan"; check && echo "DIPULIHKAN." || echo "MASIH BERMASALAH: periksa manual."
exit 1
