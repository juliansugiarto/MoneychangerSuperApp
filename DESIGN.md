# DESIGN.md — PT Ibukota Valasindo

Dua wajah, satu aplikasi (white-label: nama, logo, alamat dari Profil Perusahaan, tidak pernah ditulis mati):

| Wajah | Alamat | Gaya | Sumber kebenaran |
|---|---|---|---|
| Back office (staf) | `backoffice.<domain>` | **Konter Tebal** | `docs/superpowers/specs/2026-09-12-desain-ulang-antarmuka-design.md` + token di `client/src/index.css` |
| Halaman publik (nasabah) | `<domain>` dan `/papan` (TV outlet) | **Paspor & cap** | Bagian di bawah + rujukan hidup `docs/design/halaman-publik/rujukan-paspor-v3.html` |

Semua teks layar lewat skill `ux-wording-id`; naskah halaman publik: `docs/superpowers/specs/2026-11-12-halaman-publik-teks.md`.
Isi dan urutan bagian: `docs/superpowers/specs/2026-11-12-halaman-publik-rencana-bagian.md`.

## Halaman publik — "Paspor & cap"

**Gagasan:** setiap kunjungan adalah perjalanan nasabah. Halaman = paspor terbuka: setiap bagian satu *spread* dua
halaman visa; kurs ada di "halaman data"; hitung tukar = pas naik; permintaan konfirmasi = tiket pesawat mendatar;
kejadian penting diberi **cap karet**.

### Token
| Token | Nilai | Peran |
|---|---|---|
| `--paper` | `#E9EDF3` | latar di luar paspor |
| `--page` / `--page-2` | `#F7F8FB` / `#EFF2F7` | halaman |
| `--ink` / `--ink-2` | `#141C33` / `#47506B` | teks utama / kedua |
| `--line` / `--line-2` | `#C6CDDA` / `#DCE1EA` | garis |
| `--maroon` (+ `-d`, `-dd`) | `#7A1C2C` (`#3E0C17`, `#2A0810`) | sampul paspor, tombol utama, total; marun merek IV |
| `--gold` / `--gold-l` | `#C9A657` / `#E4CC8C` | segel sampul, papan TV |
| `--violet` | `#43309B` | tinta cap (tag bagian, "KURS BARU") |
| `--up` / `--down` | `#1D6A3A` / `#A2232B` | naik / turun, galat, cap DITERIMA |
| Tint halaman visa | sky `#E8EEF8`, rose `#F7EAEE`, mint `#E7F2EA`, sand `#F4EEE1`, lilac `#EEEAF8` | satu tint per spread |

Huruf: **Archivo** (judul tebal rapat + teks), **IBM Plex Mono** (angka, cap, MRZ, label kecil). Angka kurs selalu
`tabular-nums`. Dilarang: petrol/teal/sian, gradien ungu-biru, emoji, logo BI.

### Perangkat tanda tangan (semuanya membawa data nyata)
- **Sampul paspor** marun dengan segel IV yang terbuka saat kedatangan (≤ 1,3 s, sekali per sesi, ketuk = lewati).
- **Spread visa**: tint per bagian, garis guilloche halus, tanda air siluet masjid + segel IV, nomor seri berlubang
  "IV 0001…" di tepi atas, nomor halaman di tengah bawah, tag bagian sebagai cap ("02 | HITUNG").
- **Halaman data kurs** dengan kilau laminasi hologram (mengikuti penunjuk/gulir, di bawah teks).
- **Baris MRZ** (`P<IDNIBUKOTA<VALASINDO<<…`) di halaman data dan kaki halaman — berisi data asli (nama, kota, jam buka, kurs).
- **Pas naik** hitung tukar: DARI/KE, pesawat kecil, total marun bergulir, kode batang dari angka, sobekan.
- **Tiket mendatar** "Pas naik · Minta konfirmasi kurs": bagian utama (data penumpang = isian) + sobekan (rute, total,
  tombol). Kirim → sobekan robek, cap DITERIMA, sobekan kembali sebagai tanda terima bernomor.
- **Rute pesawat latar**: CGK · Jakarta → JED → KUL → SIN → HKG → PKX → NRT → SYD → CDG → LHR → JFK, digambar mengikuti
  gulir di margin; di ponsel/layar sempit menjadi rel tipis di tepi kiri. Bandara = valuta di papan (asal CGK, bukan Cianjur).
- **Papan TV `/papan`**: marun gelap + emas, angka ≥ 4vw, jam WIB berdetak, halaman bergilir, cap "KURS BARU" saat kurs berubah.

### Gerak
- Empat lapis: kedatangan · hidup di latar (awan, rute, jam, status buka) · peristiwa (kurs berubah → cap + angka
  bergulir di baris, waktu, kalkulator, pesan WhatsApp, papan) · umpan balik (saklar jual/beli, angka, cap, sobekan).
- Umpan balik 150–300 ms `cubic-bezier(.23,1,.32,1)`; satu gerak keras pada satu waktu (antrean cap); isi selalu
  terlihat saat diam (animasi mulai dari keadaan terlihat); `prefers-reduced-motion` = informasi tetap, gerak hilang;
  semua gerak latar berhenti saat tab tersembunyi.
- **Kinerja (diukur 12 Nov 2026, wajib dipertahankan):** submit tiket 60 fps juga pada CPU 4×. Aturan yang membuatnya
  begitu: titik rute dihitung analitik dari segmen (jangan `getPointAtLength` berulang, jangan di jalur ResizeObserver);
  tidak ada `filter` pada pembungkus elemen beranimasi; cap ber-filter SVG di lapisan sendiri tanpa `mix-blend-mode`
  selama bergerak (multiply sesudah mendarat); galat dan tanda terima tumbuh halus, tidak meloncat.

### Tata letak
- Spread dua kolom ≥ 1150 px (rasio 5/7 atau 6/6 per bagian), satu kolom di ponsel; tabel kurs ponsel = satu baris per
  pecahan ≤ 64 px, angka arah terpilih besar.
- Kontrol: isian 48 px; kontrol bersegmen setinggi isian, sorotan penuh tepi ke tepi.
- 390 px dan 1440 px tanpa gulir mendatar; fokus keyboard terlihat; kontras ≥ 4,5:1.

## Log keputusan
| Tanggal | Keputusan | Sumber |
|---|---|---|
| 2026-11-12 | Halaman publik dan back office dipisah alamat (`<domain>` / `backoffice.<domain>`) | pemilik |
| 2026-11-12 | Putaran 1 (hanya papan kurs; flap / uang / paspor) ditolak: "kurang srek … cuman nampilin 1 jenis section" → rencana bagian penuh dulu | pemilik |
| 2026-11-12 | Putaran 2: **C Paspor & cap dipilih** ("gw suka yg paspor"), bukan B cetak uang yang disarankan Claude | pemilik |
| 2026-11-12 | Tanpa stok; semua valuta aktif (awal = daftar vip.co.id); jam Sen–Sab 09–17; WA sementara 0811-260-269 | pemilik |
| 2026-11-12 | Konfirmasi kurs = tiket mendatar terpisah; latar rute pesawat mengikuti gulir; rute mulai **CGK** | pemilik |
| 2026-11-12 | Celah printer di atas tiket dibuang ("bar hitam itu apa?"); sorotan bersegmen dibetulkan | pemilik |
| 2026-11-12 | Rujukan v3.2 disetujui ("oke greate job"); dibangun ke aplikasi React sesudahnya | pemilik |
