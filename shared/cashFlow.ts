/**
 * Klasifikasi arus kas — metode langsung, satu jurnal pada satu waktu.
 *
 * Yang diklasifikasi adalah **jurnal yang benar-benar menyentuh kas**, bukan selisih saldo akun.
 * Sebuah pos yang diturunkan dari selisih saldo tidak dapat ditunjuk kembali ke jurnalnya, dan
 * temuan pemeriksaan 7.1 justru berbunyi bahwa pos laporan tidak dapat ditunjukkan asalnya.
 *
 * Dua hal sengaja **tidak** ditebak, dan keduanya jatuh ke keranjang "belum terklasifikasi" yang
 * terlihat beserta nomor jurnalnya:
 *
 * - Jurnal `MANUAL` dapat berisi apa saja. Menebaknya sekali saja sudah cukup untuk membuat seluruh
 *   laporan tidak dapat dipercaya.
 * - Jurnal yang akun lawannya jatuh ke lebih dari satu bagian tidak dibagi rata. Membagi arus kas
 *   menurut perkiraan adalah mengarang angka, dan angka karangan yang seimbang justru yang paling
 *   sulit ditangkap pemeriksa.
 */

import { CASH_ACCOUNTS } from "./currencyRevaluation";

export type CashFlowSection =
  | "OPERASI"
  | "INVESTASI"
  | "PENDANAAN"
  /** Selisih retranslasi: mengubah jumlah kas tanpa ada uang yang bergerak (SAK EP Bab 30). */
  | "PENGARUH_KURS"
  /** Pemindahan di dalam kas dan setara kas — bukan arus kas, dan tidak boleh muncul dua arah. */
  | "INTERNAL"
  | "BELUM_TERKLASIFIKASI";

export type CashEntryClassification = {
  section: CashFlowSection;
  label: string;
  /** Terisi hanya pada keranjang; alasan yang dapat dibaca manusia, bukan kode kesalahan. */
  reason?: string;
};

export type SettlementTarget = "BEBAN" | "ASET_TETAP" | null;

const isCashAccount = (code: string) => (CASH_ACCOUNTS as readonly string[]).includes(code);

/**
 * Akun lawan yang bagiannya pasti. Sengaja tidak memuat akun yang belum punya satu pun penulis:
 * baris yang tidak pernah terisi lebih berbahaya daripada baris yang belum ada, dan akun yang kelak
 * punya penulis akan muncul di keranjang beserta namanya — terlihat, bukan salah tempat.
 */
const SECTION_BY_COUNTERPART: Record<string, { section: CashFlowSection; label: string }> = {
  "5-1200": { section: "OPERASI", label: "Pembayaran pembelian UKA dan TC" },
  "4-1100": { section: "OPERASI", label: "Penerimaan penjualan UKA" },
  "7-1900": { section: "OPERASI", label: "Selisih hitungan kas" },
  "3-1100": { section: "PENDANAAN", label: "Setoran modal" },
  "3-4100": { section: "PENDANAAN", label: "Penarikan pemilik" },
  "7-1500": { section: "PENGARUH_KURS", label: "Pengaruh perubahan kurs atas kas dan setara kas" },
};

/** Akun yang bagiannya bergantung pada apa yang dilunasi, bukan pada akunnya sendiri. */
const SETTLEMENT_COUNTERPARTS: Record<string, { forTarget: Record<"BEBAN" | "ASET_TETAP", { section: CashFlowSection; label: string }>; missing: string }> = {
  "2-1900": {
    forTarget: {
      BEBAN: { section: "OPERASI", label: "Pembayaran beban operasional" },
      ASET_TETAP: { section: "INVESTASI", label: "Perolehan aset tetap" },
    },
    missing: "pelunasan kewajiban tanpa catatan sasaran; tidak dapat dipastikan beban atau aset tetap",
  },
  "1-1320": {
    forTarget: {
      BEBAN: { section: "OPERASI", label: "Penerimaan piutang lain-lain" },
      ASET_TETAP: { section: "INVESTASI", label: "Hasil pelepasan aset tetap" },
    },
    missing: "penerimaan piutang tanpa catatan sasaran; tidak dapat dipastikan asalnya",
  },
};

export function classifyCashEntry(input: {
  sourceType: string;
  /** Σ baris pada CASH_ACCOUNTS, debit dikurangi kredit. */
  cashDelta: bigint;
  counterpartAccounts: string[];
  settlementTarget: SettlementTarget;
}): CashEntryClassification {
  // Setor kas ke rekening menggerakkan dua akun kas sekaligus dan tidak mengubah jumlahnya.
  // Menyajikannya sebagai arus keluar dan arus masuk membuat kedua bagian membengkak tanpa satu
  // rupiah pun berpindah ke luar usaha.
  if (input.cashDelta === 0n) {
    return { section: "INTERNAL", label: "Pemindahan antar kas dan setara kas" };
  }

  if (input.sourceType === "MANUAL") {
    return {
      section: "BELUM_TERKLASIFIKASI",
      label: "Jurnal manual yang menyentuh kas",
      reason: "jurnal manual dapat berisi apa saja; bagiannya ditentukan manusia, bukan ditebak",
    };
  }
  if (input.sourceType === "SALDO_AWAL") {
    return {
      section: "BELUM_TERKLASIFIKASI",
      label: "Jurnal saldo awal yang menyentuh kas",
      reason: "saldo awal bukan arus kas periode ini; periksa tanggal jurnalnya",
    };
  }

  const counterparts = input.counterpartAccounts.filter((code) => !isCashAccount(code));
  const candidates: { section: CashFlowSection; label: string }[] = [];
  const unmapped: string[] = [];

  for (const code of new Set(counterparts)) {
    const settlement = SETTLEMENT_COUNTERPARTS[code];
    if (settlement) {
      if (!input.settlementTarget) {
        return { section: "BELUM_TERKLASIFIKASI", label: `Pelunasan lewat ${code}`, reason: settlement.missing };
      }
      candidates.push(settlement.forTarget[input.settlementTarget]);
      continue;
    }
    const direct = SECTION_BY_COUNTERPART[code];
    if (direct) candidates.push(direct);
    else unmapped.push(code);
  }

  if (!candidates.length) {
    return {
      section: "BELUM_TERKLASIFIKASI",
      label: "Jurnal kas berakun lawan yang belum terpetakan",
      reason: `akun lawan ${unmapped.join(", ") || "tidak ada"} belum punya bagian arus kas`,
    };
  }

  const sections = new Set(candidates.map((candidate) => candidate.section));
  if (sections.size > 1 || unmapped.length) {
    return {
      section: "BELUM_TERKLASIFIKASI",
      label: "Jurnal kas bercampur bagian",
      reason: `akun lawannya (${[...new Set(counterparts)].join(", ")}) jatuh ke lebih dari satu bagian; membaginya menurut perkiraan berarti mengarang angka`,
    };
  }

  return candidates[0];
}
