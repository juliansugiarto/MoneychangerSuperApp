import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Menjaga nota terhadap **SE BI No. 18/42/DKSP huruf G angka 1** — tujuh informasi yang paling
 * sedikit wajib dimuat bukti transaksi, dibaca 9 September 2026 dari naskah milik pengguna:
 *
 *   a. nama dan alamat Penyelenggara;
 *   b. tanggal transaksi;
 *   c. nomor serial bukti transaksi;
 *   d. jumlah nominal dan jenis mata uang yang dibayarkan OLEH Nasabah;
 *   e. jumlah nominal dan jenis mata uang yang dibayarkan KEPADA Nasabah;
 *   f. kurs atau nilai tukar; dan
 *   g. nama dan tanda tangan Penyelenggara dan Nasabah.
 *
 * Kewajiban ini berada di bawah bagian **perlindungan konsumen**, bukan pelaporan — jadi ukurannya
 * adalah apa yang dapat dibaca Nasabah pada kertasnya, bukan apa yang tersimpan di basis data.
 *
 * Identitas penyelenggara punya penjaganya sendiri di `notaKupvaIdentity.test.ts` (temuan
 * pemeriksaan 4); berkas ini menjaga daftar SE-nya sebagai satu kesatuan.
 */
const receipt = readFileSync(fileURLToPath(new URL("../client/src/pages/Transactions.tsx", import.meta.url)), "utf8");

describe("nota terhadap SE BI 18/42/DKSP huruf G angka 1", () => {
  it("a. mencetak nama dan alamat Penyelenggara", () => {
    expect(receipt).toContain("legalEntityName");
    expect(receipt).toContain("escapeHtml(address)");
  });

  it("b. mencetak tanggal transaksi", () => {
    expect(receipt).toContain("transaction.transactionAt");
    expect(receipt).toContain('toLocaleDateString("id-ID")');
  });

  it("c. mencetak nomor serial bukti transaksi", () => {
    expect(receipt).toContain("transaction.receiptNumber");
  });

  it("d dan e. menyebutkan ARAH pembayaran secara harfiah pada kedua sisinya", () => {
    // Nominal kedua sisi memang selalu tercetak, tetapi sampai 9 September 2026 arahnya hanya
    // tersirat dari kode BNB/BNS dan subtitle Inggris. Nasabah tidak dapat diminta mengetahui
    // bahwa BNB berarti pembelian; huruf d dan e menuntut keduanya terbaca sebagai informasi.
    expect(receipt).toContain('dibayarkan ${isSell ? "kepada" : "oleh"} Nasabah');
    expect(receipt).toContain('dibayarkan ${isSell ? "oleh" : "kepada"} Nasabah');
    // Arahnya harus berlawanan: valuta asing dan Rupiah tidak boleh mengalir ke pihak yang sama.
    const foreign = receipt.indexOf('Valuta asing &mdash; dibayarkan ${isSell ? "kepada" : "oleh"} Nasabah');
    const rupiah = receipt.indexOf('Jumlah Total (Rupiah) &mdash; dibayarkan ${isSell ? "oleh" : "kepada"} Nasabah');
    expect(foreign).toBeGreaterThan(-1);
    expect(rupiah).toBeGreaterThan(-1);
  });

  it("d dan e. mencetak jenis mata uang beserta nominal kedua sisinya", () => {
    expect(receipt).toContain("line.currencyCode");
    expect(receipt).toContain("line.foreignAmount");
    expect(receipt).toContain("formatIdrDecimal(line.rupiahAmount)");
  });

  it("f. mencetak kurs", () => {
    expect(receipt).toContain("line.agreedRate");
    expect(receipt).toContain("Kurs");
  });

  it("g. menyediakan nama dan tanda tangan Penyelenggara dan Nasabah", () => {
    expect(receipt).toContain("Nasabah");
    expect(receipt).toContain("Teller");
  });

  it("tetap mencetak yang MELEBIHI daftar SE — jangan dibuang saat merapikan", () => {
    // Identitas nasabah, sumber dana, tujuan transaksi, dan rincian pecahan TIDAK diminta
    // SE 18/42; semuanya berasal dari kewajiban APU/PPT/PPPSPM dan aturan pecahan proyek ini.
    // Diuji di sini supaya "merapikan nota agar sesuai SE" tidak berubah menjadi menghapusnya.
    for (const field of ["Sumber Dana", "Tujuan Transaksi", "No. KTP/Paspor", "Pecahan", "Lembar"]) {
      expect(receipt).toContain(field);
    }
  });
});
