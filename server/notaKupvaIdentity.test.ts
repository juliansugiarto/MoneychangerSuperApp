import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the nota against temuan 4 of the 2026 Bank Indonesia examination:
 *
 *   "Penggunaan nota untuk transaksi penjualan belum memenuhi standar sebagaimana ketentuan dan
 *    tidak menunjukkan identitas dari penyelenggara KUPVA BB."
 *
 * The identity that matters is the licence holder's — legal entity name, kode KUPVA, nomor izin —
 * not the shopfront name, and the printed nota is the only artefact the customer and an examiner
 * both hold. These assertions read the source rather than render it, matching how the existing
 * archive tests already guard this file.
 */
const receiptSource = readFileSync(new URL("../client/src/pages/Transactions.tsx", import.meta.url), "utf8");
const createSource = readFileSync(new URL("../client/src/pages/TransactionCreate.tsx", import.meta.url), "utf8");
const listSource = readFileSync(new URL("../client/src/pages/TransactionList.tsx", import.meta.url), "utf8");

describe("identitas penyelenggara pada nota", () => {
  it("mencetak nama badan hukum, bukan hanya nama dagang", () => {
    expect(receiptSource).toContain("legalEntityName");
    expect(receiptSource).toContain("escapeHtml(legalName)");
    // Nama dagang tetap tampil, tetapi sebagai keterangan di bawah nama badan hukum.
    expect(receiptSource).toContain("Penyelenggara KUPVA Bukan Bank");
  });

  it("mencetak kode KUPVA dan nomor izin bila profil perusahaan memuatnya", () => {
    expect(receiptSource).toContain("Kode KUPVA ${company.kupvaCode}");
    expect(receiptSource).toContain("Izin ${company.licenseNumber}");
  });

  it("menyertakan kode jenis transaksi yang dipakai pelaporan", () => {
    // BNS/BNB adalah kode yang dipakai LKU, sehingga kertas dan laporan menyebut hal yang sama.
    expect(receiptSource).toContain('isSell ? "BNS" : "BNB"');
  });

  it("merinci pecahan dan lembar, bukan hanya jumlah total", () => {
    // Temuan 3 meminta nota jual beli UKA menjadi bukti transaksi; total saja tidak membuktikan
    // lembar mana yang berpindah tangan.
    expect(receiptSource).toContain("<td class=r>Pecahan</td>");
    expect(receiptSource).toContain("<td class=r>Lembar</td>");
    expect(receiptSource).toContain("line.denominationValue");
    expect(receiptSource).toContain("line.quantity");
  });

  it("menampilkan cara bayar dalam bahasa manusia, bukan nilai enum", () => {
    expect(receiptSource).toContain('CASH: "Tunai"');
    expect(receiptSource).toContain("paymentMethodLabel[transaction.paymentMethod]");
    expect(receiptSource).not.toContain('<span class="value">${escapeHtml(transaction.paymentMethod)}</span>');
  });

  it("kedua halaman pencetak memasok identitas dan pecahan yang sama", () => {
    // Bon dari layar transaksi dan bon cetak ulang dari arsip harus identik; kalau hanya satu sisi
    // diperbaiki, cetak ulang untuk pemeriksa akan kehilangan identitas penyelenggara.
    for (const source of [createSource, listSource]) {
      expect(source).toContain("legalEntityName: companyProfile.legalEntityName");
      expect(source).toContain("kupvaCode: companyProfile.kupvaCode");
      expect(source).toContain("licenseNumber: companyProfile.licenseNumber");
      expect(source).toContain("denominationValue");
      expect(source).toContain("quantity");
    }
  });

  it("mempertahankan tanda tangan nasabah dan petugas serta ketentuan PBI", () => {
    expect(receiptSource).toContain("Teller");
    expect(receiptSource).toContain("Nasabah");
    expect(receiptSource).toContain("PBI No. 18/20/PBI/2016");
  });
});
