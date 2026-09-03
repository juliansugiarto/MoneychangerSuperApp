import { describe, expect, it } from "vitest";
import {
  KUPVA_WORK_AREA,
  allCompetencyCodes,
  buildSdmReportRows,
  buildRealisasiReport,
  buildSdmTextFile,
  certificateNumberMismatch,
  competencyCodeFromCertificate,
  competencyCodesForArea,
  parseCertificateNumber,
  formForPeriod,
  deriveSdmCounts,
  quarterEndDate,
  quarterStartDate,
  validateSdmReport,
} from "../shared/sdmCompetency";

/**
 * Sandi dan keterangan di bawah ini disalin apa adanya dari template resmi RAS01 (PADG No. 17
 * Tahun 2024). Uji ini mengunci penyusun sandi pada template tersebut: bila daftar yang dihasilkan
 * bergeser satu sandi pun, berkas yang diunggah tidak lagi sepadan dengan formulir yang diharapkan
 * penerima, dan itu baru ketahuan setelah laporan ditolak.
 */
const OFFICIAL: Array<[string, string]> = [
  ["PBKNK66SPP012", "PBK SP SDM pejabat eksekutif dalam Pengelolaan Transfer Dana"],
  ["PBKNK66SPP013", "PBK SP SDM penyelia dalam Pengelolaan Transfer Dana"],
  ["PBKNK66SPP014", "PBK SP SDM pelaksana dalam Pengelolaan Transfer Dana"],
  ["PBKNK66SPP022", "PBK SP SDM pejabat eksekutif dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKNK66SPP023", "PBK SP SDM penyelia dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKNK66SPP024", "PBK SP SDM pelaksana dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKNK66SPP032", "PBK SP SDM pejabat eksekutif dalam Pengelolaan Uang Tunai"],
  ["PBKNK66SPP033", "PBK SP SDM penyelia dalam Pengelolaan Uang Tunai"],
  ["PBKNK66SPP034", "PBK SP SDM pelaksana dalam Pengelolaan Uang Tunai"],
  ["PBKNK66SPP042", "PBK SP SDM pejabat eksekutif dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKNK66SPP043", "PBK SP SDM penyelia dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKNK66SPP044", "PBK SP SDM pelaksana dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKNK66SPP052", "PBK SP SDM pejabat eksekutif dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKNK66SPP053", "PBK SP SDM penyelia dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKNK66SPP054", "PBK SP SDM pelaksana dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKNK66SPP062", "PBK SP SDM pejabat eksekutif dalam Setelmen Transaksi Tresuri"],
  ["PBKNK66SPP063", "PBK SP SDM penyelia dalam Setelmen Transaksi Tresuri"],
  ["PBKNK66SPP064", "PBK SP SDM pelaksana dalam Setelmen Transaksi Tresuri"],
  ["PBKNK66SPP072", "PBK SP SDM pejabat eksekutif dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["PBKNK66SPP073", "PBK SP SDM penyelia dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["PBKNK66SPP074", "PBK SP SDM pelaksana dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["PBKPK66SPP012", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Pengelolaan Transfer Dana"],
  ["PBKPK66SPP013", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Pengelolaan Transfer Dana"],
  ["PBKPK66SPP014", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Pengelolaan Transfer Dana"],
  ["PBKPK66SPP022", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKPK66SPP023", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKPK66SPP024", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["PBKPK66SPP032", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Pengelolaan Uang Tunai"],
  ["PBKPK66SPP033", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Pengelolaan Uang Tunai"],
  ["PBKPK66SPP034", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Pengelolaan Uang Tunai"],
  ["PBKPK66SPP042", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKPK66SPP043", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKPK66SPP044", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Pemrosesan Transaksi Pembayaran"],
  ["PBKPK66SPP052", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKPK66SPP053", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKPK66SPP054", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["PBKPK66SPP062", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Setelmen Transaksi Tresuri"],
  ["PBKPK66SPP063", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Setelmen Transaksi Tresuri"],
  ["PBKPK66SPP064", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Setelmen Transaksi Tresuri"],
  ["PBKPK66SPP072", "Pemeliharaan Sertifikat PBK SP SDM pejabat eksekutif dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["PBKPK66SPP073", "Pemeliharaan Sertifikat PBK SP SDM penyelia dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["PBKPK66SPP074", "Pemeliharaan Sertifikat PBK SP SDM pelaksana dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKNK66SPP011", "sertifikasi kompetensi SDM level direksi dalam Pengelolaan Transfer Dana"],
  ["SKNK66SPP012", "sertifikasi kompetensi SDM pejabat eksekutif dalam Pengelolaan Transfer Dana"],
  ["SKNK66SPP013", "sertifikasi kompetensi SDM penyelia dalam Pengelolaan Transfer Dana"],
  ["SKNK66SPP014", "sertifikasi kompetensi SDM pelaksana dalam Pengelolaan Transfer Dana"],
  ["SKNK66SPP021", "sertifikasi kompetensi SDM level direksi dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKNK66SPP022", "sertifikasi kompetensi SDM pejabat eksekutif dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKNK66SPP023", "sertifikasi kompetensi SDM penyelia dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKNK66SPP024", "sertifikasi kompetensi SDM pelaksana dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKNK66SPP031", "sertifikasi kompetensi SDM level direksi dalam Pengelolaan Uang Tunai"],
  ["SKNK66SPP032", "sertifikasi kompetensi SDM pejabat eksekutif dalam Pengelolaan Uang Tunai"],
  ["SKNK66SPP033", "sertifikasi kompetensi SDM penyelia dalam Pengelolaan Uang Tunai"],
  ["SKNK66SPP034", "sertifikasi kompetensi SDM pelaksana dalam Pengelolaan Uang Tunai"],
  ["SKNK66SPP041", "sertifikasi kompetensi SDM level direksi dalam Pemrosesan Transaksi Pembayaran"],
  ["SKNK66SPP042", "sertifikasi kompetensi SDM pejabat eksekutif dalam Pemrosesan Transaksi Pembayaran"],
  ["SKNK66SPP043", "sertifikasi kompetensi SDM penyelia dalam Pemrosesan Transaksi Pembayaran"],
  ["SKNK66SPP044", "sertifikasi kompetensi SDM pelaksana dalam Pemrosesan Transaksi Pembayaran"],
  ["SKNK66SPP051", "sertifikasi kompetensi SDM level direksi dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKNK66SPP052", "sertifikasi kompetensi SDM pejabat eksekutif dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKNK66SPP053", "sertifikasi kompetensi SDM penyelia dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKNK66SPP054", "sertifikasi kompetensi SDM pelaksana dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKNK66SPP061", "sertifikasi kompetensi SDM level direksi dalam Setelmen Transaksi Tresuri"],
  ["SKNK66SPP062", "sertifikasi kompetensi SDM pejabat eksekutif dalam Setelmen Transaksi Tresuri"],
  ["SKNK66SPP063", "sertifikasi kompetensi SDM penyelia dalam Setelmen Transaksi Tresuri"],
  ["SKNK66SPP064", "sertifikasi kompetensi SDM pelaksana dalam Setelmen Transaksi Tresuri"],
  ["SKNK66SPP071", "sertifikasi kompetensi SDM level direksi dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKNK66SPP072", "sertifikasi kompetensi SDM pejabat eksekutif dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKNK66SPP073", "sertifikasi kompetensi SDM penyelia dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKNK66SPP074", "sertifikasi kompetensi SDM pelaksana dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKPK66SPP011", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Pengelolaan Transfer Dana"],
  ["SKPK66SPP012", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Pengelolaan Transfer Dana"],
  ["SKPK66SPP013", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Pengelolaan Transfer Dana"],
  ["SKPK66SPP014", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Pengelolaan Transfer Dana"],
  ["SKPK66SPP021", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKPK66SPP022", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKPK66SPP023", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKPK66SPP024", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Penatausahaan Surat Berharga Negara Milik Nasabah"],
  ["SKPK66SPP031", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Pengelolaan Uang Tunai"],
  ["SKPK66SPP032", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Pengelolaan Uang Tunai"],
  ["SKPK66SPP033", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Pengelolaan Uang Tunai"],
  ["SKPK66SPP034", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Pengelolaan Uang Tunai"],
  ["SKPK66SPP041", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Pemrosesan Transaksi Pembayaran"],
  ["SKPK66SPP042", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Pemrosesan Transaksi Pembayaran"],
  ["SKPK66SPP043", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Pemrosesan Transaksi Pembayaran"],
  ["SKPK66SPP044", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Pemrosesan Transaksi Pembayaran"],
  ["SKPK66SPP051", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKPK66SPP052", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKPK66SPP053", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKPK66SPP054", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Penukaran Valas dan Pembawaan Uang Kertas Asing"],
  ["SKPK66SPP061", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Setelmen Transaksi Tresuri"],
  ["SKPK66SPP062", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Setelmen Transaksi Tresuri"],
  ["SKPK66SPP063", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Setelmen Transaksi Tresuri"],
  ["SKPK66SPP064", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Setelmen Transaksi Tresuri"],
  ["SKPK66SPP071", "Pemeliharaan Sertifikat Kompetensi SDM level direksi dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKPK66SPP072", "Pemeliharaan Sertifikat Kompetensi SDM pejabat eksekutif dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKPK66SPP073", "Pemeliharaan Sertifikat Kompetensi SDM penyelia dalam Setelmen Pembayaran Transaksi Trade Finance"],
  ["SKPK66SPP074", "Pemeliharaan Sertifikat Kompetensi SDM pelaksana dalam Setelmen Pembayaran Transaksi Trade Finance"]
];

describe("sandi kompetensi SDM sistem pembayaran", () => {
  it("menghasilkan tepat 98 sandi seperti template resmi, dengan urutan yang sama", () => {
    const generated = allCompetencyCodes();
    expect(generated).toHaveLength(98);
    expect(generated.map((row) => row.code)).toEqual(OFFICIAL.map(([code]) => code));
  });

  it("menghasilkan keterangan yang sama persis dengan template", () => {
    const generated = allCompetencyCodes();
    for (const [index, [code, keterangan]] of OFFICIAL.entries()) {
      expect(generated[index].code, `sandi ke-${index}`).toBe(code);
      expect(generated[index].keterangan, code).toBe(keterangan);
    }
  });

  it("menyaring 14 sandi yang berlaku bagi KUPVA BB", () => {
    const kupva = competencyCodesForArea(KUPVA_WORK_AREA);
    // Bidang 05 Penukaran Valas: PBK dan pemeliharaannya tanpa jenjang direksi (3+3), sertifikasi
    // kompetensi dan pemeliharaannya dengan direksi (4+4).
    expect(kupva).toHaveLength(14);
    expect(kupva.map((row) => row.code)).toEqual([
      "PBKNK66SPP052", "PBKNK66SPP053", "PBKNK66SPP054",
      "PBKPK66SPP052", "PBKPK66SPP053", "PBKPK66SPP054",
      "SKNK66SPP051", "SKNK66SPP052", "SKNK66SPP053", "SKNK66SPP054",
      "SKPK66SPP051", "SKPK66SPP052", "SKPK66SPP053", "SKPK66SPP054",
    ]);
    // Seluruhnya benar-benar ada pada template resmi.
    const official = new Set(OFFICIAL.map(([code]) => code));
    for (const row of kupva) expect(official.has(row.code), row.code).toBe(true);
  });

  it("tidak mengenal jenjang direksi untuk sertifikat PBK", () => {
    // Template tidak memuat PBKNK/PBKPK berakhiran 1; menghasilkannya berarti melaporkan sandi
    // yang tidak dikenal penerima.
    expect(OFFICIAL.some(([code]) => /^PBK(NK|PK)66SPP\d{2}1$/.test(code))).toBe(false);
    expect(allCompetencyCodes().some((row) => /^PBK(NK|PK)66SPP\d{2}1$/.test(row.code))).toBe(false);
  });
});

describe("periode dan pemilihan formulir", () => {
  it("memakai akhir triwulan sebagai periodeData", () => {
    expect(quarterEndDate(2025, 3)).toBe("2025-09-30");
    expect(quarterEndDate(2026, 4)).toBe("2026-12-31");
  });

  it("berpindah dari rap01 ke ras01 setelah masa peralihan berakhir", () => {
    // Masa peralihan berakhir 31 Desember 2026; triwulan terakhirnya masih memakai rap01.
    expect(formForPeriod("2026-09-30")).toBe("rap01");
    expect(formForPeriod("2026-12-31")).toBe("rap01");
    expect(formForPeriod("2027-03-31")).toBe("ras01");
  });
});

describe("berkas teks unggahan", () => {
  const rows = buildSdmReportRows(KUPVA_WORK_AREA, {
    PBKNK66SPP054: { posisiKeseluruhanSDM: 4, posisiSDMYangMemilikiSertifikat: 1, rencanaSertifikasiSDM: 3, realisasiSertifikasiSDM: 1 },
  });

  it("melaporkan seluruh sandi bidang, termasuk yang bernilai nol", () => {
    // Template memuat seluruh sandi; menghilangkan baris kosong membuat berkas tidak sepadan.
    expect(rows).toHaveLength(14);
    expect(rows.filter((row) => row.posisiKeseluruhanSDM === 0)).toHaveLength(13);
  });

  it("berpembatas pipa, delapan kolom, tanggal yyyy-mm-dd", () => {
    const text = buildSdmTextFile({ idPelapor: "500000000", periodeData: quarterEndDate(2026, 3), rows });
    const lines = text.split("\n");
    expect(lines[0]).toBe("idPelapor|periodeLaporan|periodeData|rincianPemenuhanKompetensi|posisiKeseluruhanSDM|posisiSDMYangMemilikiSertifikat|rencanaSertifikasiSDM|realisasiSertifikasiSDM");
    expect(lines).toHaveLength(15);
    expect(lines.every((line) => line.split("|").length === 8)).toBe(true);
    // Kolom keterangan sengaja tidak ikut terkirim.
    expect(text).not.toContain("Penukaran Valas dan Pembawaan Uang Kertas Asing");
    expect(lines).toContain("500000000|Q|2026-09-30|PBKNK66SPP054|4|1|3|1");
  });
});

describe("pemeriksaan sebelum unggah", () => {
  it("menolak jumlah bersertifikat yang melebihi keseluruhan SDM", () => {
    const rows = buildSdmReportRows(KUPVA_WORK_AREA, { SKNK66SPP054: { posisiKeseluruhanSDM: 2, posisiSDMYangMemilikiSertifikat: 3 } });
    expect(validateSdmReport(rows)[0]).toContain("SKNK66SPP054");
  });

  it("menolak jumlah negatif atau pecahan", () => {
    const rows = buildSdmReportRows(KUPVA_WORK_AREA, { SKNK66SPP051: { rencanaSertifikasiSDM: -1 } });
    expect(validateSdmReport(rows)).not.toHaveLength(0);
  });

  it("meloloskan laporan yang wajar", () => {
    const rows = buildSdmReportRows(KUPVA_WORK_AREA, { SKNK66SPP054: { posisiKeseluruhanSDM: 5, posisiSDMYangMemilikiSertifikat: 5, rencanaSertifikasiSDM: 0, realisasiSertifikasiSDM: 0 } });
    expect(validateSdmReport(rows)).toEqual([]);
  });
});

describe("menurunkan angka laporan dari catatan pegawai", () => {
  const period = { periodStart: quarterStartDate(2026, 3), periodEnd: quarterEndDate(2026, 3) };
  const teller = { id: 1, jobLevel: "PELAKSANA" as const, competencyTrack: "SERTIFIKASI_KOMPETENSI" as const, employmentStatus: "AKTIF" as const, joinedAt: "2024-01-05" };
  const supervisor = { id: 2, jobLevel: "PENYELIA" as const, competencyTrack: "SERTIFIKASI_KOMPETENSI" as const, employmentStatus: "AKTIF" as const, joinedAt: "2023-03-01" };
  const direktur = { id: 3, jobLevel: "DIREKSI" as const, competencyTrack: "PBK" as const, employmentStatus: "AKTIF" as const, joinedAt: "2020-01-01" };

  const rowFor = (rows: ReturnType<typeof deriveSdmCounts>, code: string) => rows.find((row) => row.code === code)!;

  it("menghitung kewajiban menurut jenjang dan jalur kompetensi", () => {
    const rows = deriveSdmCounts({ area: KUPVA_WORK_AREA, ...period, employees: [teller, supervisor], certifications: [] });
    expect(rowFor(rows, "SKNK66SPP054").posisiKeseluruhanSDM).toBe(1); // pelaksana
    expect(rowFor(rows, "SKNK66SPP053").posisiKeseluruhanSDM).toBe(1); // penyelia
    expect(rowFor(rows, "SKNK66SPP052").posisiKeseluruhanSDM).toBe(0); // tidak ada pejabat eksekutif
    // Jalur sertifikasi kompetensi tidak menimbulkan kewajiban PBK.
    expect(rowFor(rows, "PBKNK66SPP054").posisiKeseluruhanSDM).toBe(0);
  });

  it("tidak membebani jenjang direksi dengan sandi PBK yang memang tidak ada", () => {
    const rows = deriveSdmCounts({ area: KUPVA_WORK_AREA, ...period, employees: [direktur], certifications: [] });
    // Template tidak punya PBKNK berjenjang direksi, jadi kewajibannya tidak dapat dilaporkan
    // di mana pun - dan tidak boleh diam-diam digeser ke jenjang lain.
    expect(rows.filter((row) => row.posisiKeseluruhanSDM > 0)).toHaveLength(0);
  });

  it("menghitung pemegang sertifikat hanya bila masih berlaku pada akhir periode", () => {
    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA, ...period,
      employees: [teller, supervisor],
      certifications: [
        { employeeId: 1, competencyCode: "SKNK66SPP054", issuedAt: "2025-02-01" },
        { employeeId: 2, competencyCode: "SKNK66SPP053", issuedAt: "2023-06-01", expiresAt: "2026-01-31" },
      ],
    });
    expect(rowFor(rows, "SKNK66SPP054").posisiSDMYangMemilikiSertifikat).toBe(1);
    // Sertifikat penyelia sudah kedaluwarsa sebelum akhir periode.
    expect(rowFor(rows, "SKNK66SPP053").posisiSDMYangMemilikiSertifikat).toBe(0);
  });

  it("menghitung realisasi hanya untuk sertifikat yang terbit dalam periode", () => {
    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA, ...period,
      employees: [teller, supervisor],
      certifications: [
        { employeeId: 1, competencyCode: "SKNK66SPP054", issuedAt: "2026-08-15" }, // dalam triwulan III
        { employeeId: 2, competencyCode: "SKNK66SPP053", issuedAt: "2026-02-10" }, // triwulan I
      ],
    });
    expect(rowFor(rows, "SKNK66SPP054").realisasiSertifikasiSDM).toBe(1);
    expect(rowFor(rows, "SKNK66SPP053").realisasiSertifikasiSDM).toBe(0);
    // Namun keduanya tetap terhitung sebagai pemegang sertifikat.
    expect(rowFor(rows, "SKNK66SPP053").posisiSDMYangMemilikiSertifikat).toBe(1);
  });

  it("membebankan kewajiban pemeliharaan hanya setelah sertifikat dasar dimiliki", () => {
    const tanpaSertifikat = deriveSdmCounts({ area: KUPVA_WORK_AREA, ...period, employees: [teller], certifications: [] });
    expect(rowFor(tanpaSertifikat, "SKPK66SPP054").posisiKeseluruhanSDM).toBe(0);

    const sudahBersertifikat = deriveSdmCounts({
      area: KUPVA_WORK_AREA, ...period,
      employees: [teller],
      certifications: [{ employeeId: 1, competencyCode: "SKNK66SPP054", issuedAt: "2025-02-01" }],
    });
    expect(rowFor(sudahBersertifikat, "SKPK66SPP054").posisiKeseluruhanSDM).toBe(1);
  });

  it("mengabaikan pegawai yang sudah tidak aktif pada akhir periode", () => {
    const keluar = { ...teller, endedAt: "2026-05-31" };
    const rows = deriveSdmCounts({ area: KUPVA_WORK_AREA, ...period, employees: [keluar], certifications: [] });
    expect(rowFor(rows, "SKNK66SPP054").posisiKeseluruhanSDM).toBe(0);
  });

  it("mengambil rencana dari tabel rencana, bukan menurunkannya", () => {
    // Rencana adalah keputusan manajemen; menurunkannya dari fakta akan membuat kolom itu selalu
    // sama dengan realisasi dan laporan kehilangan maknanya.
    const rows = deriveSdmCounts({ area: KUPVA_WORK_AREA, ...period, employees: [teller], certifications: [], plans: { SKNK66SPP054: 2 } });
    expect(rowFor(rows, "SKNK66SPP054").rencanaSertifikasiSDM).toBe(2);
    expect(rowFor(rows, "SKNK66SPP053").rencanaSertifikasiSDM).toBe(0);
  });

  it("menghasilkan laporan yang lolos pemeriksaan dan siap diunggah", () => {
    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA, ...period,
      employees: [teller, supervisor],
      certifications: [{ employeeId: 1, competencyCode: "SKNK66SPP054", issuedAt: "2026-08-15" }],
      plans: { SKNK66SPP053: 1 },
    });
    expect(validateSdmReport(rows)).toEqual([]);
    const text = buildSdmTextFile({ idPelapor: "777249293", periodeData: period.periodEnd, rows });
    expect(text).toContain("777249293|Q|2026-09-30|SKNK66SPP054|1|1|0|1");
    expect(text).toContain("777249293|Q|2026-09-30|SKNK66SPP053|1|0|1|0");
  });
});

describe("jenjang di luar SDM pelaku SK SP", () => {
  it("tidak pernah membebani komisaris dengan kewajiban sertifikasi", () => {
    // Komisaris tercantum dalam struktur organisasi dan menyetujui kebijakan APU PPT, tetapi
    // jenjangnya tidak memiliki sandi kompetensi pada template. Membebankan kewajiban kepadanya
    // akan memunculkan angka yang tidak punya tempat pelaporan.
    const komisaris = { id: 9, jobLevel: "KOMISARIS" as unknown as "DIREKSI", competencyTrack: "SERTIFIKASI_KOMPETENSI" as const, employmentStatus: "AKTIF" as const, joinedAt: "2020-01-01" };
    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA,
      periodStart: quarterStartDate(2026, 3),
      periodEnd: quarterEndDate(2026, 3),
      employees: [komisaris],
      certifications: [],
    });
    expect(rows.every((row) => row.posisiKeseluruhanSDM === 0)).toBe(true);
  });
});

describe("nomor sertifikat PBK", () => {
  it("membaca bidang, jenjang KKNI, dan tanggal dari nomor sertifikat", () => {
    // Contoh nyata dari sertifikat LPK LPPI perusahaan.
    const parsed = parseCertificateNumber("SPPUR - 05 - 04 - 09122024 - LPKLPPI - 0000637");
    expect(parsed).toMatchObject({ area: "05", kkniLevel: 4, level: 4, issuedOn: "2024-12-09", institution: "LPKLPPI", sequence: "0000637" });
  });

  it("memetakan jenjang KKNI ke angka sandi yang benar, bukan menyamakannya", () => {
    // Sertifikat menulis PENYELIA (5) dan PEJABAT EKSEKUTIF (6), sedangkan sandi laporan memakai
    // 3 dan 2. Menyamakan angkanya akan menaruh sertifikat pada baris yang salah.
    expect(parseCertificateNumber("SPPUR-05-05-10022025-LPKLPPI-0000011")?.level).toBe(3);
    expect(parseCertificateNumber("SPPUR-05-06-08052025-LPKLPPI-0000015")?.level).toBe(2);
    expect(parseCertificateNumber("SPPUR-05-04-09122024-LPKLPPI-0000637")?.level).toBe(4);
  });

  it("menghasilkan sandi kompetensi langsung dari nomor sertifikat", () => {
    expect(competencyCodeFromCertificate("SPPUR-05-05-10022025-LPKLPPI-0000011")).toBe("PBKNK66SPP053");
    expect(competencyCodeFromCertificate("SPPUR-05-06-08052025-LPKLPPI-0000015")).toBe("PBKNK66SPP052");
    expect(competencyCodeFromCertificate("SPPUR-05-04-09122024-LPKLPPI-0000637")).toBe("PBKNK66SPP054");
  });

  it("menolak nomor yang tidak mengikuti pola tanpa menebak", () => {
    expect(parseCertificateNumber("bukan nomor sertifikat")).toBeNull();
    expect(parseCertificateNumber("SPPUR-99-04-09122024-LPKLPPI-0000637")).toBeNull(); // bidang tak dikenal
    expect(parseCertificateNumber("SPPUR-05-09-09122024-LPKLPPI-0000637")).toBeNull(); // jenjang tak dikenal
  });

  it("menandai ketidakcocokan antara nomor sertifikat dan sandi yang dipilih", () => {
    // Sertifikat jenjang pelaksana dicatat pada sandi penyelia.
    expect(certificateNumberMismatch("SPPUR-05-04-09122024-LPKLPPI-0000637", "PBKNK66SPP053")).toContain("PBKNK66SPP053");
    expect(certificateNumberMismatch("SPPUR-05-04-09122024-LPKLPPI-0000637", "PBKNK66SPP054")).toBeNull();
    // Nomor di luar pola tidak menghalangi pencatatan.
    expect(certificateNumberMismatch("INTERNAL-2024-001", "PBKNK66SPP054")).toBeNull();
  });
});

describe("jenjang pelaporan berbeda dari struktur organisasi", () => {
  it("melaporkan direktur pada jenjang sertifikatnya, bukan jenjang jabatannya", () => {
    // Direktur perusahaan ini bersertifikat PBK jenjang Pejabat Eksekutif (6), dan template memang
    // tidak punya sandi PBK untuk direksi. Tanpa jenjang pelaporan, kewajiban dan sertifikatnya
    // sama-sama hilang dari laporan.
    const direktur = {
      id: 7,
      jobLevel: "DIREKSI" as const,
      competencyLevel: "PEJABAT_EKSEKUTIF" as const,
      competencyTrack: "PBK" as const,
      employmentStatus: "AKTIF" as const,
      joinedAt: "2020-01-01",
    };
    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA,
      periodStart: quarterStartDate(2025, 2),
      periodEnd: quarterEndDate(2025, 2),
      employees: [direktur],
      certifications: [{ employeeId: 7, competencyCode: "PBKNK66SPP052", issuedAt: "2025-05-08" }],
    });
    const pejabat = rows.find((row) => row.code === "PBKNK66SPP052")!;
    expect(pejabat.posisiKeseluruhanSDM).toBe(1);
    expect(pejabat.posisiSDMYangMemilikiSertifikat).toBe(1);
    expect(pejabat.realisasiSertifikasiSDM).toBe(1);
  });
});

describe("laporan realisasi Lampiran X/XI B.II dan B.IV", () => {
  const period = { periodStart: quarterStartDate(2026, 3), periodEnd: quarterEndDate(2026, 3) };
  const teller = { id: 1, jobLevel: "PELAKSANA" as const, competencyTrack: "PBK" as const, employmentStatus: "AKTIF" as const, joinedAt: "2024-01-05" };
  const direktur = { id: 2, jobLevel: "DIREKSI" as const, competencyTrack: "SERTIFIKASI_KOMPETENSI" as const, employmentStatus: "AKTIF" as const, joinedAt: "2020-01-01" };

  it("bagian B.II untuk PBK hanya memiliki tiga jenjang, tanpa direksi", () => {
    const report = buildRealisasiReport({ track: "PBK", area: KUPVA_WORK_AREA, ...period, employees: [teller], certifications: [] });
    expect(report.section).toBe("B.II");
    expect(report.columns.map((column) => column.label)).toEqual(["Pelaksana", "Penyelia", "Pejabat Eksekutif"]);
  });

  it("bagian B.IV untuk Sertifikasi Kompetensi memiliki kolom Direksi", () => {
    // Hanya sandi SKNK/SKPK yang mengenal jenjang direksi, dan formulir B.IV memang menampilkannya.
    const report = buildRealisasiReport({ track: "KOMPETENSI", area: KUPVA_WORK_AREA, ...period, employees: [direktur], certifications: [] });
    expect(report.section).toBe("B.IV");
    expect(report.columns.map((column) => column.label)).toEqual(["Pelaksana", "Penyelia", "Pejabat Eksekutif", "Direksi"]);
    expect(report.columns.find((column) => column.label === "Direksi")?.totalSdm).toBe(1);
  });

  it("menghitung akumulasi dan persentasenya terhadap seluruh SDM wajib", () => {
    const dua = [teller, { ...teller, id: 3 }];
    const report = buildRealisasiReport({
      track: "PBK", area: KUPVA_WORK_AREA, ...period,
      employees: dua,
      certifications: [{ employeeId: 1, competencyCode: "PBKNK66SPP054", issuedAt: "2025-02-01" }],
    });
    expect(report.totalSdm).toBe(2);
    expect(report.totalAkumulasi).toBe(1);
    expect(report.persentaseAkumulasi).toBe(50);
  });

  it("melaporkan nol persen ketika belum ada kewajiban, bukan NaN", () => {
    const report = buildRealisasiReport({ track: "PBK", area: KUPVA_WORK_AREA, ...period, employees: [], certifications: [] });
    expect(report.persentaseAkumulasi).toBe(0);
    expect(Number.isNaN(report.persentaseAkumulasi)).toBe(false);
  });

  it("memakai Lampiran XI selama masa peralihan dan X sesudahnya", () => {
    const peralihan = buildRealisasiReport({ track: "PBK", area: KUPVA_WORK_AREA, periodStart: quarterStartDate(2026, 4), periodEnd: quarterEndDate(2026, 4), employees: [], certifications: [] });
    const sesudah = buildRealisasiReport({ track: "PBK", area: KUPVA_WORK_AREA, periodStart: quarterStartDate(2027, 1), periodEnd: quarterEndDate(2027, 1), employees: [], certifications: [] });
    expect(peralihan.lampiran).toBe("XI");
    expect(sesudah.lampiran).toBe("X");
  });

  it("memisahkan rencana dari realisasi pada baris yang sama", () => {
    const report = buildRealisasiReport({
      track: "PBK", area: KUPVA_WORK_AREA, ...period,
      employees: [teller],
      certifications: [{ employeeId: 1, competencyCode: "PBKNK66SPP054", issuedAt: "2026-08-01" }],
      plans: { PBKNK66SPP054: 1 },
    });
    const pelaksana = report.columns.find((column) => column.label === "Pelaksana")!;
    expect(pelaksana.rencanaBase).toBe(1);
    expect(pelaksana.realisasiBase).toBe(1);
    expect(pelaksana.akumulasi).toBe(1);
  });
});
