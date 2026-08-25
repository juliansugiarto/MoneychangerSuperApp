// Markdown adapter entry.
// Prepared projects receive report-theme.typ beside this file.

#import "@preview/cmarker:0.1.10"
#import "@preview/mitex:0.2.7": mitex
#import "@preview/glossarium:0.5.10": make-glossary, register-glossary, print-glossary
#import "report-theme.typ": report-theme

#let markdown-source = "source.md"
#let glossary-entries = (
  (key: "usecase", short: "Use case", long: "Skenario penggunaan", description: "Gambaran tujuan, pelaku, prasyarat, alur, pengecualian, dan hasil sebuah pekerjaan sistem."),
  (key: "kyc", short: "KYC", long: "Know Your Customer", description: "Pemeriksaan serta pencatatan identitas dan profil nasabah sesuai prosedur."),
  (key: "buy sell", short: "BUY/SELL", long: "Arah transaksi valuta", description: "Pembelian atau penjualan valuta sesuai kejadian nyata di outlet."),
  (key: "opname", short: "Stock opname", long: "Penghitungan fisik persediaan", description: "Pembandingan kas fisik dengan catatan sistem per mata uang."),
  (key: "maker checker", short: "Maker-checker", long: "Pemisahan pembuat dan pemeriksa", description: "Kontrol bahwa pembuat paket tidak menyetujui paketnya sendiri."),
  (key: "lku", short: "LKU", long: "Laporan Kegiatan Usaha", description: "Bahan paket pelaporan internal dari transaksi produksi selesai dalam periode terkait."),
  (key: "simulasi", short: "Simulasi Aman", long: "Latihan operasional terisolasi", description: "Latihan tanpa penulisan transaksi, kas, laporan, arsip, atau audit produksi."),
  (key: "b0002", short: "B0002/B0003/B0004", long: "Form keuangan internal", description: "Form neraca, laba rugi, dan perubahan ekuitas yang dipetakan terkendali."),
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
  #text(size: 27pt, weight: "bold", fill: rgb("18395f"))[Use Case dan Skenario Operasional]
  #v(0.5cm)
  #text(size: 15pt, fill: rgb("4f914c"))[Sistem Operasional PT Ibukota Valasindo]
  #v(0.8cm)
  #text(size: 10.5pt, fill: rgb("64748b"))[Dokumen internal untuk alur kerja, kontrol, pengecualian, dan bukti operasional]
  #v(3.5cm)
  #text(size: 9pt, fill: rgb("64748b"))[Versi dokumentasi: 25 Agustus 2026]
]

#pagebreak()

// mitex renders LaTeX equations found in the Markdown source.
#cmarker.render(read(markdown-source), math: mitex)

#pagebreak(weak: true)
#heading(level: 1)[Glosarium]
#print-glossary(glossary-entries, show-all: true, disable-back-references: true)
