/**
 * Catatan atas Laporan Keuangan — daftar catatannya, sifatnya, dan panduan isinya.
 *
 * CALK-nya hibrida (keputusan pengguna 5 September 2026): catatan yang angkanya diketahui buku
 * besar **dibangkitkan** dan tidak pernah diketik, sehingga mustahil berselisih dengan laporannya;
 * catatan yang memang pertimbangan manajemen berupa **teks tersimpan**.
 *
 * Tidak ada satu pun teks contoh di berkas ini, dan itu disengaja. Kebijakan akuntansi adalah
 * pernyataan yang ditandatangani manajemen, dan pemeriksa membaca CALK justru untuk mengetahui apa
 * yang benar-benar diputuskan manajemen. Yang disediakan hanya `guidance`: penjelasan apa yang SAK
 * EP minta pada catatan itu, ditampilkan di samping medan isiannya.
 */

export type FinancialNoteKind = "BANGKITAN" | "NARATIF";

export type FinancialNoteDefinition = {
  key: string;
  title: string;
  kind: FinancialNoteKind;
  /** Apa yang harus ada di catatan ini. Ditampilkan sebagai penuntun, bukan sebagai isi. */
  guidance: string;
};

export const FINANCIAL_NOTES: FinancialNoteDefinition[] = [
  {
    key: "INFORMASI_UMUM",
    title: "Informasi umum",
    kind: "NARATIF",
    guidance:
      "Nama badan hukum, nomor izin, NPWP, dan alamat dibangkitkan dari Profil Perusahaan. Yang ditulis di sini: kegiatan usaha utama, riwayat pendirian dan perubahan anggaran dasar, serta susunan pengurus pada akhir periode.",
  },
  {
    key: "DASAR_PENYUSUNAN",
    title: "Dasar penyusunan dan pernyataan kepatuhan",
    kind: "NARATIF",
    guidance:
      "Pernyataan bahwa laporan disusun sesuai SAK EP, dasar pengukurannya (biaya historis), mata uang penyajian dan mata uang fungsional, serta periode yang dicakup. SAK EP Bab 3 menempatkan tanggung jawab penyusunan pada manajemen, bukan pada akuntan.",
  },
  {
    key: "KEBIJAKAN_AKUNTANSI",
    title: "Ikhtisar kebijakan akuntansi signifikan",
    kind: "NARATIF",
    guidance:
      "Kebijakan yang benar-benar dipakai outlet ini: pengakuan pendapatan penjualan valuta, persediaan periodik untuk UKA dan TC, penjabaran pos moneter valuta asing pada kurs penutup, metode dan umur manfaat penyusutan, serta batas kapitalisasi aset tetap. Tulis kebijakan yang dijalankan, bukan kebijakan yang seharusnya.",
  },
  {
    key: "PERTIMBANGAN_DAN_ESTIMASI",
    title: "Pertimbangan dan sumber estimasi ketidakpastian",
    kind: "NARATIF",
    guidance:
      "Estimasi yang paling mungkin berubah: umur manfaat dan nilai residu aset tetap, penyisihan piutang bila ada, dan dasar pemilihan kurs penutup. Sebutkan siapa yang meninjaunya dan kapan.",
  },
  {
    key: "KAS_DAN_SETARA_KAS",
    title: "Kas dan setara kas",
    kind: "BANGKITAN",
    guidance:
      "Rincian 1-1110 Kas Rupiah, 1-1120 Bank Rupiah, dan 1-1220 Bank UKA beserta saldo valuta per mata uang. Kas UKA fisik (1-1210) tidak termasuk — ia persediaan, bukan setara kas.",
  },
  {
    key: "PERSEDIAAN_UKA",
    title: "Persediaan uang kertas asing",
    kind: "BANGKITAN",
    guidance:
      "Nilai persediaan akhir hasil penilaian penutupan periode, beserta kuantitas dan kurs yang benar-benar dipakai serta tanggal kursnya.",
  },
  {
    key: "ASET_TETAP",
    title: "Aset tetap",
    kind: "BANGKITAN",
    guidance:
      "Per aset: harga perolehan, akumulasi penyusutan, nilai buku, umur manfaat, dan beban penyusutan periode berjalan.",
  },
  {
    key: "KEWAJIBAN_LAIN_LAIN",
    title: "Kewajiban lain-lain",
    kind: "BANGKITAN",
    guidance:
      "Rincian 2-1900 menurut asalnya — beban yang belum dibayar dan perolehan aset yang belum dilunasi — beserta umur masing-masing. Jumlahnya wajib sama dengan saldo 2-1900 pada neraca.",
  },
  {
    key: "EKUITAS",
    title: "Ekuitas",
    kind: "BANGKITAN",
    guidance:
      "Modal disetor, laba ditahan, dividen atau penarikan pemilik, dan laba periode berjalan yang belum ditutup.",
  },
  {
    key: "PENDAPATAN_DAN_BEBAN",
    title: "Rincian pendapatan dan beban",
    kind: "BANGKITAN",
    guidance:
      "Rincian tiap akun pendapatan, harga pokok, beban operasional, pos lain-lain, dan pajak, beserta angka pembanding periode sebelumnya.",
  },
  {
    key: "SELISIH_KURS",
    title: "Laba/(rugi) selisih kurs",
    kind: "BANGKITAN",
    guidance:
      "Per mata uang: saldo valuta, kurs penutup dan tanggalnya, nilai tercatat sebelum dan sesudah retranslasi, serta selisihnya (SAK EP Bab 30).",
  },
  {
    key: "TRANSAKSI_NONKAS",
    title: "Transaksi nonkas yang signifikan",
    kind: "BANGKITAN",
    guidance:
      "Perolehan aset tetap dan beban yang belum dibayar tunai pada periode ini. SAK EP mengeluarkannya dari Laporan Arus Kas dan memintanya diungkapkan di sini — bukan disajikan sebagai arus kas yang tidak terjadi.",
  },
  {
    key: "PIHAK_BERELASI",
    title: "Transaksi dengan pihak berelasi",
    kind: "NARATIF",
    guidance:
      "Transaksi dengan pemilik, pengurus, dan keluarganya beserta nilainya dan syaratnya — termasuk setoran dan penarikan modal, sewa dari pihak berelasi, dan pinjaman. Bila tidak ada, tulis bahwa tidak ada.",
  },
  {
    key: "PERISTIWA_SETELAH_PERIODE",
    title: "Peristiwa setelah periode pelaporan",
    kind: "NARATIF",
    guidance:
      "Peristiwa antara akhir periode dan tanggal laporan disetujui terbit, dan apakah ia menyesuaikan angka laporan atau hanya diungkapkan. Catatan ini biasanya berbeda tiap periode; simpan sebagai teks khusus periodenya.",
  },
  {
    key: "PERIKATAN_DAN_KONTINJENSI",
    title: "Perikatan dan kewajiban kontinjensi",
    kind: "NARATIF",
    guidance:
      "Perjanjian sewa yang masih berjalan, jaminan yang diberikan, perkara hukum, dan sanksi regulator yang belum selesai. Bila tidak ada, tulis bahwa tidak ada.",
  },
];

export const NARRATIVE_NOTE_KEYS = FINANCIAL_NOTES.filter((note) => note.kind === "NARATIF").map((note) => note.key);
export const GENERATED_NOTE_KEYS = FINANCIAL_NOTES.filter((note) => note.kind === "BANGKITAN").map((note) => note.key);

const NOTE_BY_KEY = new Map(FINANCIAL_NOTES.map((note) => [note.key, note]));

export const findFinancialNote = (key: string) => NOTE_BY_KEY.get(key) ?? null;

/** Bulan sebuah rentang laporan, "YYYY-MM" — kunci periode teks naratif. */
export const notePeriodKey = (to: string) => to.slice(0, 7);
