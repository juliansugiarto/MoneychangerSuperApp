import { describe, expect, it } from "vitest";
import { classifyCashEntry, type SettlementTarget } from "./cashFlow";

const entry = (over: Partial<Parameters<typeof classifyCashEntry>[0]> = {}) => ({
  sourceType: "TRANSAKSI_VALUTA", cashDelta: -1_000_000n, counterpartAccounts: ["5-1200"],
  settlementTarget: null as SettlementTarget, ...over,
});

describe("classifyCashEntry", () => {
  it("menempatkan pembelian dan penjualan UKA pada bagian operasi", () => {
    expect(classifyCashEntry(entry())).toMatchObject({ section: "OPERASI", label: "Pembayaran pembelian UKA dan TC" });
    expect(classifyCashEntry(entry({ cashDelta: 1_000_000n, counterpartAccounts: ["4-1100"] })))
      .toMatchObject({ section: "OPERASI", label: "Penerimaan penjualan UKA" });
  });

  it("membedakan pelunasan beban dari pelunasan aset tetap lewat sasarannya, bukan akun lawannya", () => {
    // Keduanya mendebit 2-1900 dengan jurnal yang sama persis. Yang membedakan bagian operasi dari
    // bagian investasi hanyalah baris ledger_settlements — dan itu tercatat, bukan ditebak.
    const base = entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["2-1900"] });
    expect(classifyCashEntry({ ...base, settlementTarget: "BEBAN" })).toMatchObject({ section: "OPERASI" });
    expect(classifyCashEntry({ ...base, settlementTarget: "ASET_TETAP" })).toMatchObject({ section: "INVESTASI", label: "Perolehan aset tetap" });
  });

  it("menempatkan hasil pelepasan aset tetap pada bagian investasi", () => {
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_KAS", cashDelta: 2_500_000n, counterpartAccounts: ["1-1320"], settlementTarget: "ASET_TETAP" })))
      .toMatchObject({ section: "INVESTASI", label: "Hasil pelepasan aset tetap" });
  });

  it("menempatkan setoran modal dan penarikan pemilik pada bagian pendanaan", () => {
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_KAS", cashDelta: 5_000_000n, counterpartAccounts: ["3-1100"] })))
      .toMatchObject({ section: "PENDANAAN", label: "Setoran modal" });
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_BANK", counterpartAccounts: ["3-4100"] })))
      .toMatchObject({ section: "PENDANAAN", label: "Penarikan pemilik" });
  });

  it("menempatkan selisih hitungan kas pada bagian operasi", () => {
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["7-1900"] })))
      .toMatchObject({ section: "OPERASI", label: "Selisih hitungan kas" });
  });

  it("menyajikan revaluasi kurs sebagai penyeimbang tersendiri, bukan arus operasi", () => {
    // Selisih retranslasi mengubah jumlah kas tanpa ada uang yang bergerak (SAK EP Bab 30).
    expect(classifyCashEntry(entry({ sourceType: "REVALUASI_KURS", counterpartAccounts: ["7-1500"] })))
      .toMatchObject({ section: "PENGARUH_KURS" });
  });

  it("mengeluarkan pemindahan antar kas dan setara kas, bukan menyajikannya dua arah", () => {
    // Setor kas ke rekening menggerakkan 1-1110 dan 1-1120 sekaligus; jumlah kasnya tidak berubah.
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_KAS", cashDelta: 0n, counterpartAccounts: [] })))
      .toMatchObject({ section: "INTERNAL" });
  });

  it("tidak pernah mengklasifikasi jurnal manual, meski akun lawannya kebetulan cocok", () => {
    const result = classifyCashEntry(entry({ sourceType: "MANUAL", counterpartAccounts: ["3-1100"] }));
    expect(result.section).toBe("BELUM_TERKLASIFIKASI");
    expect(result.reason).toMatch(/manual/i);
  });

  it("tidak memperlakukan jurnal saldo awal sebagai arus kas periode ini", () => {
    expect(classifyCashEntry(entry({ sourceType: "SALDO_AWAL", counterpartAccounts: ["3-1100"] })))
      .toMatchObject({ section: "BELUM_TERKLASIFIKASI" });
  });

  it("menolak membagi jurnal yang akun lawannya jatuh ke lebih dari satu bagian", () => {
    const result = classifyCashEntry(entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["3-1100", "5-1200"] }));
    expect(result.section).toBe("BELUM_TERKLASIFIKASI");
    expect(result.reason).toMatch(/lebih dari satu bagian/);
  });

  it("menandai pelunasan yang kehilangan baris sasarannya, bukan menebak bagiannya", () => {
    const result = classifyCashEntry(entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["2-1900"], settlementTarget: null }));
    expect(result.section).toBe("BELUM_TERKLASIFIKASI");
    expect(result.reason).toMatch(/tanpa catatan sasaran/);
  });

  it("menyebutkan akun lawan yang belum punya bagian", () => {
    const result = classifyCashEntry(entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["2-1300"] }));
    expect(result.section).toBe("BELUM_TERKLASIFIKASI");
    expect(result.reason).toContain("2-1300");
  });

  it("mengabaikan akun kas lain pada daftar lawan, karena keduanya sisi kas yang sama", () => {
    expect(classifyCashEntry(entry({ sourceType: "MUTASI_KAS", counterpartAccounts: ["1-1120", "3-1100"], cashDelta: 5_000_000n })))
      .toMatchObject({ section: "PENDANAAN" });
  });
});
