import * as XLSX from "xlsx";

function reportSheet(marker: string, title: string, headers: string[]) {
  return XLSX.utils.aoa_to_sheet([
    [marker],
    [title],
    ["", "", "JENIS LAPORAN: PVA"],
    ["", "", "PERIODE LAPORAN: isi sesuai periode yang direkonsiliasi"],
    [],
    ["", "", "Valid", "No", "Record No", ...headers],
  ]);
}

export function createFinancialWorkbookTemplate() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["PETUNJUK TEMPLATE LAPORAN KEUANGAN"],
    ["1. Isi periode laporan yang telah direkonsiliasi pada setiap form."],
    ["2. Jangan mengubah penanda FORM B0002, FORM B0003, dan FORM B0004 atau baris judul kolom."],
    ["3. Isi Record No, nama pos, dan nilai pada tiap form; gunakan angka tanpa rumus eksternal."],
    ["4. Controller memeriksa pemetaan sebelum menyimpan snapshot; Shareholder yang berbeda memeriksa paket."],
    ["5. Template ini tidak dikirim ke regulator dan tidak membuktikan kewajiban pelaporan."],
  ]), "Petunjuk");
  XLSX.utils.book_append_sheet(workbook, reportSheet("FORM B0002", "LAPORAN KEUANGAN NERACA", ["Pos Akun", "Nilai"]), "B0002 Neraca");
  XLSX.utils.book_append_sheet(workbook, reportSheet("FORM B0003", "LAPORAN KEUANGAN - LABA/RUGI", ["Pos akun laba rugi", "Nilai"]), "B0003 Laba Rugi");
  XLSX.utils.book_append_sheet(workbook, reportSheet("FORM B0004", "LAPORAN PERUBAHAN EKUITAS", ["Keterangan perubahan ekuitas", "Modal Disetor", "Laba Ditahan/Akumulasi Rugi"]), "B0004 Ekuitas");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
