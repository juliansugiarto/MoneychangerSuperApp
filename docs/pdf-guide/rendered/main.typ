// Markdown adapter entry.
// Prepared projects receive report-theme.typ beside this file.

#import "@preview/cmarker:0.1.10"
#import "@preview/mitex:0.2.7": mitex
#import "@preview/glossarium:0.5.10": make-glossary, register-glossary, print-glossary
#import "report-theme.typ": report-theme

#let markdown-source = "source.md"
#let glossary-entries = (
  (key: "apuppt", short: "APUPPT", long: "Anti Pencucian Uang dan Pencegahan Pendanaan Terorisme", description: "Kontrol internal yang mendukung pemeriksaan dan pengawasan transaksi sesuai kebijakan perusahaan."),
  (key: "buy", short: "BUY", long: "Pembelian valuta", description: "Arah transaksi ketika outlet membeli valuta dari nasabah."),
  (key: "sell", short: "SELL", long: "Penjualan valuta", description: "Arah transaksi ketika outlet menjual valuta kepada nasabah."),
  (key: "kyc", short: "KYC", long: "Know Your Customer", description: "Pemeriksaan dan pencatatan identitas serta profil nasabah sesuai prosedur perusahaan."),
  (key: "lku", short: "LKU", long: "Laporan Kegiatan Usaha", description: "Bahan paket pelaporan internal yang hanya menggunakan transaksi produksi selesai dalam periode terkait."),
  (key: "maker-checker", short: "Maker-checker", long: "Pemisahan pembuat dan pemeriksa", description: "Kontrol yang mencegah pembuat paket menyetujui atau mengembalikan paketnya sendiri."),
  (key: "opname", short: "Stock opname", long: "Penghitungan fisik persediaan", description: "Perbandingan kas fisik terhadap catatan sistem per mata uang."),
  (key: "jis dor", short: "JISDOR", long: "Jakarta Interbank Spot Dollar Rate", description: "Salah satu referensi nilai tukar yang dapat dipantau; bukan aktivasi kurs outlet otomatis."),
  (key: "b0002", short: "B0002", long: "Form Neraca", description: "Bagian laporan keuangan yang dipetakan secara terkendali dari sumber yang telah direkonsiliasi."),
  (key: "b0003", short: "B0003", long: "Form Laba Rugi", description: "Bagian laporan keuangan yang dipetakan secara terkendali dari sumber yang telah direkonsiliasi."),
  (key: "b0004", short: "B0004", long: "Form Perubahan Ekuitas", description: "Bagian laporan keuangan yang dipetakan secara terkendali dari sumber yang telah direkonsiliasi."),
  (key: "simulasi", short: "Simulasi Aman", long: "Latihan operasional terisolasi", description: "Latihan yang tidak menulis transaksi, kas, laporan, arsip, atau audit produksi."),
)

#show: make-glossary
#register-glossary(glossary-entries)

#show: report-theme.with(
  first-line-indent: none,
  running-header: false,
)

// cmarker emits tables with all-auto column widths. Re-emit those tables as
// full-width, booktabs-style tables while leaving explicitly sized tables alone.
#show table: it => {
  if it.columns.len() > 0 and it.columns.all(column => column == auto) {
    table(
      columns: (1fr,) * it.columns.len(),
      align: it.align,
      stroke: none,
      inset: (x: 10pt, y: 7pt),
      fill: (_, y) => if y > 0 and calc.even(y) { luma(248) } else { none },
      table.hline(stroke: 1pt),
      ..it.children.filter(
        child => child.func() != table.hline and child.func() != table.vline,
      ),
      table.hline(stroke: 1pt),
    )
  } else {
    it
  }
}
#show table.cell.where(y: 0): set text(weight: "bold")

#align(center)[
  #v(3.8cm)
  #text(size: 27pt, weight: "bold", fill: rgb("18395f"))[Buku Panduan Penggunaan A–Z]
  #v(0.5cm)
  #text(size: 15pt, fill: rgb("4f914c"))[Sistem Operasional PT Ibukota Valasindo]
  #v(0.8cm)
  #text(size: 10.5pt, fill: rgb("64748b"))[Panduan internal untuk Staff, Admin/Supervisor, Controller/Direksi, dan Shareholder]
  #v(3.5cm)
  #text(size: 9pt, fill: rgb("64748b"))[Versi dokumentasi: 25 Agustus 2026]
]

#pagebreak()

// mitex renders LaTeX equations found in the Markdown source.
#cmarker.render(read(markdown-source), math: mitex)

#pagebreak(weak: true)
#heading(level: 1)[Glosarium]
#print-glossary(glossary-entries, show-all: true, disable-back-references: true)
