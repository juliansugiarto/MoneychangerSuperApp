# Perkakas Sesi: yang Dipakai, yang Ditolak, dan Alasannya

Ditetapkan 9 September 2026 sesudah membaca
<https://scottech.software/posts/developer-setup-ai-tools> ("local AI coding + memory stack",
tujuh lapis: Claude Code hooks/skills, Headroom, Conductor, Graphify, Obsidian, Codex CLI, RTK).

Yang diambil dari artikel itu adalah **polanya** — kaskade instruksi, hook yang menyuntikkan
keadaan, dan ingatan yang ditaruh di luar konteks model — bukan daftar perkakasnya.

---

## Yang dipasang

### 1. `~/.claude/CLAUDE.md` — aturan mesin

Dimuat pada setiap sesi di mesin ini, semua proyek. Sengaja pendek: bahasa, zona waktu operasional
GMT+7, jebakan lingkungan macOS (`pnpm` tidak di PATH, klien MySQL, `mysqldump --set-gtid-purged=OFF`,
larangan `prettier`), disiplin verifikasi, dan **bagian hemat token**.

Bagian hemat token itulah pengganti Headroom/RTK yang tidak memakai perkakas pihak ketiga: baca
berpanah alih-alih berkas utuh, cari dulu baca kemudian, pangkas keluaran perintah di sumbernya,
jangan membaca ulang berkas yang baru diedit, kirim panggilan tool yang independen dalam satu blok.

### 2. `~/.claude/hooks/next-task.sh` — SessionStart

Menjawab "sampai mana kemarin?" secara otomatis. Menyapu `docs/superpowers/plans/*.md`, mengambil
bagian `## Status Pengerjaan` tiap rencana, dan menyuntikkan checkbox pertama yang belum tercentang
beserta nama berkas rencananya.

Diam total bila `docs/superpowers/PROMPT-SESI.md` tidak ada, jadi aman di repo lain.

Lahir dari kejadian nyata: sesi 9 September 2026 dibuka dengan *"i forgot to copy last message go-to
prompt from last session"*. Hook ini menghapus kebutuhan menyalin apa pun.

Uji manual:
```bash
echo '{"cwd":"'$PWD'"}' | ~/.claude/hooks/next-task.sh | jq -r '.hookSpecificOutput.additionalContext'
```

### 3. `~/.claude/hooks/aturan-keras.sh` — UserPromptSubmit

Mencocokkan kata pada prompt terhadap enam kelompok aturan keras `CLAUDE.md` dan menyuntikkan
**hanya yang cocok**: produksi, kas/pecahan/dua kaki transaksi, migrasi/enum, kurs, impor/audit,
dan ejaan PPSPM/PPPSPM/DPPSPM.

Diam bila `CLAUDE.md` di direktori kerja tidak memuat bagian "Aturan Keras Operasional". Ia ada di
setelan global, bukan repo, supaya proyek berikutnya yang memakai konvensi sama ikut mendapatkannya.

Uji manual:
```bash
echo '{"prompt":"perbaiki posting kas untuk bon jual","cwd":"'$PWD'"}' | ~/.claude/hooks/aturan-keras.sh
echo '{"prompt":"apa kabar","cwd":"'$PWD'"}' | ~/.claude/hooks/aturan-keras.sh   # harus kosong
```

### 4. `.claude/skills/serah-terima/` — skill penutup sesi

Padanan `/obsidian-save` pada artikel, tetapi **ditinjau manusia dan masuk git**. Menulis ulang blok
keadaan `PROMPT-SESI.md` dari keadaan terukur: jumlah uji yang benar-benar dijalankan, migrasi
terakhir, checkbox rencana, risiko residual baru.

Artikel menjalankan agen latar dengan `--dangerously-skip-permissions` dari hook `PostCompact` untuk
menulis ke vault. Itu **sengaja tidak diambil**: tulisan otonom tanpa tinjauan tidak punya tempat di
repo yang memegang pembukuan teregulasi.

### 5. `AGENTS.md` → symlink ke `CLAUDE.md`

`AGENTS.md` adalah berkas yang dibaca Codex CLI dan sebagian agen lain. Symlink menjaga satu sumber
kebenaran tanpa duplikasi.

---

## Yang ditolak, beserta alasannya

Jangan mengusulkannya ulang tanpa alasan baru.

| Lapis | Keputusan | Alasan |
|---|---|---|
| **Headroom** (proxy kompresi API) | Ditolak | `pip install` pihak ketiga yang duduk di antara Claude Code dan API Anthropic dan menulis ulang **setiap** permintaan. Lalu lintas itu memuat nama field KYC, isi `.env`, skema basis data produksi, dan data audit. Masalah kedua: ia memampatkan kode dan keluaran tool **sebelum model melihatnya** — masukan yang lossy secara senyap adalah pertukaran yang salah untuk buku besar teregulasi yang ketepatan angkanya adalah produknya. |
| **RTK** (penulis ulang perintah shell) | Ditolak | Kelas risiko sama, radius lebih kecil. Penghematannya nyata tetapi dapat dicapai dengan disiplin baca/pangkas yang kini tertulis di `~/.claude/CLAUDE.md`. |
| **Graphify** (graf pengetahuan kode) | Ditolak | Repo ini 622 berkas terlacak. Graf mulai berguna pada repo puluhan ribu berkas; di sini `Grep` dan agen `Explore` sudah menang, tanpa artefak yang harus dijaga tetap segar. |
| **Conductor** (worktree paralel) | Ditolak | Metode kerja proyek ini **sengaja** satu tugas per sesi dengan urutan tugas yang mengikat (Tugas 1 sebelum 2, dan seterusnya). Worktree paralel melawan itu, bukan membantunya. |
| **Obsidian** (second brain) | Ditolak | `docs/superpowers/` sudah menjadi second brain proyek ini — spec, rencana, ROADMAP, PROMPT-SESI — dan ia **masuk git**, ditinjau, serta hidup di sebelah kode yang dijelaskannya. Vault Obsidian akan menjadi salinan kedua yang tidak berversi di aplikasi yang tidak terpasang. |

---

## Ditunda, bukan ditolak: Codex CLI sebagai pendapat kedua

Berguna ketika sebuah bug menolak menyerah dan yang dibutuhkan adalah model lain yang membacanya
dengan asumsi berbeda. Menunggu akun OpenAI.

Resep pemasangannya bila kelak diinginkan:

```bash
npm install -g @openai/codex
codex login
```

Lalu aktifkan plugin `codex` dari marketplace plugin Claude Code (`/plugin`). Ia mendaftarkan
subagen `codex:codex-rescue` serta perintah `/codex:rescue`, `/codex:review`, dan `/codex:status`.
`AGENTS.md` sudah ada, jadi Codex akan membaca konvensi repo ini sejak panggilan pertama.

Sampai itu terjadi, pendapat kedua diambil dari yang sudah ada: agen `Explore`, `/code-review`, dan
subagen `code-simplifier`.

---

## Bila sebuah hook berulah

Hook gagal secara senyap by design. Untuk mendiagnosis, jalankan berkasnya langsung dengan payload
JSON seperti pada contoh di atas. Untuk mematikannya sementara, buang entrinya dari `hooks` pada
`~/.claude/settings.json` — cadangan bertanggal ada di `~/.claude/settings.json.bak-*`.
