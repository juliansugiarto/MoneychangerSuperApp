# Menjalankan aplikasi di VPS (tumpukan Docker, bersama tokoemas)

Tanggal 12 November 2026 (WIB). Menggantikan `deploy.sh` + pm2 + `.github/workflows/deploy.yml` (server lama
187.53.128.14 mati 12 Nov 2026; berkas lama dihapus, ada di riwayat git).

## Gambaran

- VPS tokoemas `187.77.148.118` (Hostinger KVM 4: 4 vCPU, 16 GB, 193 GB; Ubuntu 24.04, zona waktu server UTC, user `deploy`).
  Tokoemas sudah memegang port 80/443 lewat Caddy-nya sendiri di balik Cloudflare.
- Satu money changer = satu tumpukan Docker = satu basis data (keputusan `docs/decisions/2026-11-12-daring-satu-perusahaan-white-label.md`):

| Layanan | Isi |
|---|---|
| `mysql` | MySQL 8.4, UTC, utf8mb4; batas memori `MYSQL_MEM_LIMIT` (bawaan 2 GB) agar tidak menghimpit tokoemas |
| `web` (kontainer `moneychanger-web`) | `node dist/index.js` (image dari `Dockerfile`), batas 1 GB; ikut jaringan `mc_edge` bersama Caddy tokoemas |
| `backup` | tiap 01.00 WIB: `mysqldump` → zstd → AES-256 (openssl) → volume lokal (7 terakhir) + R2 |
| `ops` (profil) | `node scripts/migrate.mjs`, `node scripts/tenant.mjs setup-code` |
| `restore-check` (profil) | MySQL kosong di tmpfs untuk `restore-test.sh` |

- Jaringan `mc_edge` (172.30.0.0/24, alamat otomatis hanya .0–.127) berisi **hanya** Caddy tokoemas (alamat tetap
  172.30.0.254) dan aplikasi money changer. Bukan `tokoemas_default`: kontainer tokoemas lain tidak dapat menghubungi
  aplikasi ini langsung (melewati daftar IP Cloudflare), dan aplikasi ini tidak dapat menghubungi Postgres tokoemas.
- Caddy menuju **nama kontainer** `<COMPOSE_PROJECT_NAME>-web` (`moneychanger-web`), unik per perusahaan; nama layanan
  `web` dipakai bersama semua tumpukan money changer di jaringan itu sehingga tidak boleh dirujuk.
- IP pengunjung: Caddy mengganti `X-Forwarded-For` dengan satu nilai (`{client_ip}` dari `CF-Connecting-IP`), aplikasi
  hanya mempercayai alamat Caddy (`TRUST_PROXY=loopback, 172.30.0.254`, `server/proxyTrust.ts`). Gladi 12 Nov 2026:
  lewat alamat Caddy, lima salah sandi mengunci IP pengunjung itu saja (429) sementara IP pengunjung lain tetap 401;
  dari alamat lain di jaringan yang sama, X-Forwarded-For palsu diabaikan (kunci tetap pada alamat kontainernya).

## Yang diputuskan/disiapkan pemilik lebih dulu

1. **Domain**: `ibukotavalasindo.online` sudah tidak terpasang. Pilih domain, pindahkan nameserver ke Cloudflare
   (seperti ibkshop.com), `A <domain> → 187.77.148.118` (proxied), SSL/TLS **Full (strict)**.
2. **Sertifikat Origin CA** Cloudflare untuk domain itu (kunci dibuat di VPS, seperti tokoemas `vps-live.md`).
3. **Dua bucket R2 + dua token terpisah**: dokumen KYC (`R2_*`) dan cadangan (`BACKUP_R2_*`). Pada bucket cadangan pasang
   aturan siklus hidup "hapus objek sesudah 35 hari" (skrip tidak menghapus apa pun di R2).
4. Simpan `BACKUP_CIPHER_PASS` di pengelola sandi pemilik. Tanpa itu cadangan **tidak bisa dibuka**.

## Pemasangan pertama (di VPS, sebagai `deploy`)

```bash
# Kode tanpa deploy key: di Mac → git bundle create mc.bundle <cabang>; scp mc.bundle deploy@187.77.148.118:/tmp/
docker network create --subnet 172.30.0.0/24 --ip-range 172.30.0.0/25 mc_edge   # sekali per VPS
sudo mkdir -p /opt/moneychanger && sudo chown deploy: /opt/moneychanger
git clone /tmp/mc.bundle /opt/moneychanger && cd /opt/moneychanger/deploy/vps
./init-env.sh                                   # .env mode 600, rahasia acak dibuat
nano .env                                       # APP_VERSION=$(git rev-parse --short HEAD), R2_*, BACKUP_*
docker compose build
docker compose up -d mysql
docker compose run --rm ops node scripts/migrate.mjs     # "Migrasi tercatat: 67 (baru diterapkan: 67)" per 12 Nov 2026
docker compose up -d web backup
docker compose ps                                # web (healthy), mysql (healthy)
```

Lalu sisi tokoemas (sesi tokoemas atau pemilik, **sesudah toko tutup**):
1. salin `deploy/vps/tokoemas-caddy-override.yaml` ke `/opt/tokoemas/deploy/vps/compose.mc-edge.yaml` dan tambahkan ke
   `COMPOSE_FILE` di `.env` tokoemas (`compose.yaml:compose.cloudflare.yaml:compose.mc-edge.yaml`);
2. tempel isi `deploy/vps/caddy-site.caddy` ke `Caddyfile.cloudflare` tokoemas (ganti `DOMAIN-MONEYCHANGER`);
3. taruh sertifikat di `/opt/tokoemas/deploy/vps/certs/mc-origin.{pem,key}`;
4. `docker compose up -d --force-recreate caddy` di folder tokoemas.
Cek: `curl -fsS https://<domain>/` → 200, dan `https://ibkshop.com` tetap 200.

Penyiapan perusahaan:

```bash
docker compose run --rm ops node scripts/tenant.mjs setup-code   # kode 24 jam, dicetak sekali
```

Buka `https://<domain>`, masukkan kode pada "Siapkan perusahaan Anda" (profil perusahaan, akun pemilik).

Bukti cadangan bisa dipulihkan (wajib sebelum go-live):

```bash
docker compose exec backup backup.sh
./restore-test.sh        # LULUS/GAGAL (exit 1): jumlah tabel & migrasi sama, tabel inti terbaca dan tidak lebih dari live
```

## Pembaruan versi (sesudah jam operasional)

```bash
cd /opt/moneychanger && git fetch /tmp/mc.bundle <cabang> && git merge --ff-only FETCH_HEAD
cd deploy/vps
docker compose exec backup backup.sh                       # titik pulih sebelum migrasi; catat jam WIB
sed -i "s/^APP_VERSION=.*/APP_VERSION=$(git rev-parse --short HEAD)/" .env
docker compose build web
docker compose run --rm ops node scripts/migrate.mjs
docker compose up -d web
curl -fsS https://<domain>/ >/dev/null && echo OK
docker image prune -f
```

Migrasi yang merusak data tidak pernah dijalankan tanpa persetujuan tertulis pemilik (CLAUDE.md). Pulih penuh dari
cadangan: hentikan `web`, dekripsi berkas seperti di `restore-test.sh`, muat ke `mysql`, jalankan lagi.

## Perusahaan kedua (white-label)

Salin folder ke `/opt/<kode>` (atau klon kedua), di `.env` ganti `COMPOSE_PROJECT_NAME=<kode>`, jalankan `init-env.sh`
(rahasia baru), domain + sertifikat + blok Caddy sendiri dengan `reverse_proxy <kode>-web:3000`. Identitas (nama, logo, alamat) diisi lewat wizard penyiapan, bukan kode.

## Gladi di Mac

```bash
cd deploy/vps && ./init-env.sh && export COMPOSE_FILE=compose.yaml:compose.local.yaml
# Mac dengan VM Docker 2 GB: di .env pakai MYSQL_BUFFER_POOL=256M dan MYSQL_MEM_LIMIT=768m
docker compose build && docker compose up -d mysql && docker compose run --rm ops node scripts/migrate.mjs
docker compose up -d web backup     # http://127.0.0.1:3200 (3100 dipakai Playwright)
docker compose exec backup backup.sh && ./restore-test.sh
docker compose down -v                           # bersihkan (menghapus volume gladi)
```

Hasil gladi 12 Nov 2026: image aplikasi 658 MB; migrasi 67 pada basis data kosong (skema sama persis kolom per kolom dengan
`moneychanger` lokal, 936 kolom); `/` dan kesehatan 200, header keamanan produksi aktif; cadangan data uji lokal
(124 KB terenkripsi) pulih utuh: 73 tabel, 67 migrasi, users 4, customers 6, exchange_transactions 16, journal_entries
12, audit_logs 614 sama dengan live, dua kali berturut-turut.
Uji negatif: berkas cadangan terbaru rusak → `restore-test.sh` exit 1 dan kontainer uji tetap dihapus; tujuan R2 tidak
terjangkau → `backup.sh` exit 1 ("GAGAL kirim"), salinan lokal tetap ada, tanpa sisa `.part`.
Pelajaran gladi: (1) VM Docker 2 GB di Mac membunuh mysqld (OOM) bila dua MySQL + aplikasi + Postgres proyek lain
berjalan; karena itu `mem_limit` MySQL dan `restore-check` yang ringan. (2) `mysqladmin ping` lewat soket lolos saat
server sementara milik entrypoint masih inisialisasi; uji pulih menunggu lewat TCP.

## Belum

- Sinkron kurs BI (`/api/scheduled/bi-rate-sync`) belum dijadwalkan di tumpukan ini (Caddy menolaknya dari internet).
- Pemeriksaan kesehatan `web` tidak menyentuh MySQL (MySQL punya pemeriksaannya sendiri).
- Pemantauan: belum ada ping keberhasilan cadangan (tokoemas memakai `BACKUP_PING_URL`); sementara cek
  `docker compose logs backup | grep cadangan`.
- Image 658 MB: dependensi produksi besar (AWS SDK, SheetJS); belum dirampingkan.
