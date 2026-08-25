# Prinsip UX emil-design-eng untuk Redesign IBV

Dokumen ini merekam prinsip yang akan digunakan dalam perancangan ulang front office dan back office IBV. Prinsip bersumber dari skill publik `emil-design-eng` karya Emil Kowalski, yang berfokus pada polish UI, desain komponen, keputusan animasi, dan detail interaksi.[1]

| Prinsip | Penerapan pada IBV |
| --- | --- |
| Detail kecil membentuk kualitas pengalaman. | Gunakan hierarki informasi yang tegas, spacing konsisten, state kosong yang membantu, dan feedback aksi yang spesifik. |
| Motion harus dipilih secara sadar. | Animasi hanya digunakan untuk transisi panel, menu, dan umpan balik aksi; durasi singkat dan dapat dikurangi melalui preferensi reduced motion. |
| Animasi mengutamakan `transform` dan `opacity`. | Hindari animasi layout berat; tombol menampilkan respons tekan yang halus. |
| Masuknya elemen berkelompok dibuat bertahap. | Kartu kurs dan bagian dashboard dapat muncul berurutan ringan, tanpa menunda alur kasir atau input keyboard. |
| Popover berasal dari titik pemicunya; modal tetap berpusat. | Menu profil, filter, dan tindakan baris memakai origin-aware transform; dialog konfirmasi tetap terpusat. |

> Prinsip ini akan digunakan sebagai pedoman craft, bukan untuk menyalin merek, layout, kode, atau aset dari situs lain.

## Referensi

[1]: https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md "emil-design-eng — Emil Kowalski"
