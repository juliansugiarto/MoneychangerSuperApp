import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIC_ROLE_DECREE_CODES, PIC_ROLE_TITLES, companyInitials, suggestDecreeNumber } from "../client/src/lib/suratKeputusan";

const source = readFileSync(new URL("../client/src/lib/suratKeputusan.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Kepegawaian.tsx", import.meta.url), "utf8");

describe("nomor surat keputusan", () => {
  it("mengikuti pola yang sudah dipakai perusahaan", () => {
    // SK yang sudah terbit bernomor 001/APU-PPT/IBV/2026.
    expect(suggestDecreeNumber("APU_PPT", "PT Ibu Kota Valasindo", 1, 2026)).toBe("001/APU-PPT/IKV/2026");
    expect(suggestDecreeNumber("INTERNAL_AUDIT", "PT Ibu Kota Valasindo", 12, 2026)).toBe("012/AUDIT/IKV/2026");
  });

  it("menyusun inisial dari nama badan hukum tanpa awalan PT", () => {
    expect(companyInitials("PT Ibu Kota Valasindo")).toBe("IKV");
    expect(companyInitials("PT. Sumber Maju Jaya")).toBe("SMJ");
    // Nama kosong tetap menghasilkan sesuatu yang dapat dipakai, bukan nomor yang rusak.
    expect(companyInitials("")).toBe("SK");
  });

  it("memiliki sebutan jabatan dan singkatan untuk setiap fungsi", () => {
    for (const role of Object.keys(PIC_ROLE_TITLES)) {
      expect(PIC_ROLE_DECREE_CODES[role], role).toBeTruthy();
    }
    expect(PIC_ROLE_TITLES.APU_PPT).toBe("Petugas APU dan PPT");
  });
});

describe("isi surat keputusan", () => {
  it("memuat kalimat baku dan rujukan KUPVA BB seperti surat yang berlaku", () => {
    expect(source).toContain("SURAT KEPUTUSAN");
    expect(source).toContain("Berdasarkan kebijakan manajemen");
    expect(source).toContain("Kegiatan Usaha Penukaran Valuta Asing Bukan Bank (KUPVA BB)");
    expect(source).toContain("Telah secara resmi ditunjuk menjadi");
    expect(source).toContain("berlaku selama menjadi pegawai");
  });

  it("mencetak identitas pegawai yang diminta surat", () => {
    expect(source).toContain("No. KTP");
    expect(source).toContain("Alamat");
    expect(source).toContain("input.employee.identityNumber");
    expect(source).toContain("input.employee.address");
  });

  it("menyediakan ruang tanda tangan beserta nama dan jabatan penanda tangan", () => {
    expect(source).toContain("ttd");
    expect(source).toContain("input.signatory.fullName");
    expect(source).toContain("input.signatory.position");
  });

  it("menunda cetak sampai logo termuat", () => {
    // Sama seperti kwitansi: memanggil print() sebelum logo tergambar menghasilkan kop kosong.
    expect(source).toContain("window.__skPrint");
    expect(source).toContain("onload=\"window.__skPrint()\"");
  });

  it("menolak mencetak surat yang identitasnya belum lengkap", () => {
    // Surat dengan tanda hubung pada kolom KTP atau alamat tidak layak ditandatangani, jadi
    // dicegah sebelum jendela cetak terbuka.
    expect(pageSource).toContain("Lengkapi No. KTP dan alamat pegawai sebelum mencetak surat keputusan.");
    expect(pageSource).toContain("Belum ada direksi aktif yang dapat menandatangani surat.");
  });
});

describe("Lampiran X / XI rencana tahunan", () => {
  const lampiran = readFileSync(new URL("../client/src/lib/lampiranSdm.ts", import.meta.url), "utf8");

  it("memuat judul dan rujukan peraturan seperti formulir resmi", () => {
    expect(lampiran).toContain("PERATURAN ANGGOTA DEWAN GUBERNUR NOMOR 17 TAHUN 2024");
    expect(lampiran).toContain("TANGGAL 19 NOVEMBER 2024");
    expect(lampiran).toContain("Rencana Pemenuhan Kepemilikan dan Pemeliharaan Sertifikat PBK Sistem Pembayaran");
    expect(lampiran).toContain("Nama Pelaku SK SP");
  });

  it("membedakan kalimat judul Lampiran XI masa peralihan dari Lampiran X", () => {
    expect(lampiran).toContain("Masa Peralihan s.d 31 Desember 2026");
    expect(lampiran).toContain("Untuk Seluruh SDM Pelaku SK SP yang Wajib Memiliki");
  });

  it("menyajikan dua total rencana penyediaan dana yang diminta formulir", () => {
    expect(lampiran).toContain("Total Rencana Penyediaan Dana PBK Sistem Pembayaran Tahun Berikutnya");
    expect(lampiran).toContain("Total Rencana Penyediaan Dana Pemeliharaan Sertifikat PBK Sistem Pembayaran Tahun Berikutnya");
  });

  it("menyusun kolom triwulan untuk kedua jenis rencana", () => {
    // Formulir memakai delapan kolom triwulan: empat untuk PBK, empat untuk pemeliharaan.
    expect(lampiran).toContain('["Tw I", "Tw II", "Tw III", "Tw IV"]');
    expect(lampiran).toContain("quarterHeads.concat(quarterHeads)");
    expect(lampiran).toContain('colspan="4"');
  });

  it("dicetak mendatar karena tabelnya lebar", () => {
    expect(lampiran).toContain("size: A4 landscape");
  });
});
