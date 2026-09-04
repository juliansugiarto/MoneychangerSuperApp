import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS, findAccount, isBalanceSheetAccount } from "../shared/chartOfAccounts";
import {
  accountBalance,
  assertJournalIsPostable,
  buildTrialBalance,
  carryForwardBalance,
  formatAmount,
  isoDay,
  monthEndIso,
  monthStartIso,
  oppositeSide,
  parseAmount,
  reconcileCash,
  summariseJournal,
} from "../shared/ledger";

describe("nominal buku besar", () => {
  it("membaca dan menulis kembali nominal tanpa kehilangan sen", () => {
    expect(formatAmount(parseAmount("1250000.75"))).toBe("1250000.75");
    expect(formatAmount(parseAmount("0.05"))).toBe("0.05");
    expect(formatAmount(parseAmount("500000000"))).toBe("500000000.00");
  });

  it("melengkapi satu angka desimal menjadi sen, bukan membacanya sebagai satu sen", () => {
    // "0.5" adalah lima puluh sen. Membacanya sebagai lima sen menggeser setiap angka sepuluh kali.
    expect(parseAmount("0.5")).toBe(50n);
  });

  it("menjumlahkan ribuan baris tanpa selisih pembulatan", () => {
    // Inilah alasan buku besar tidak memakai number: 0.1 + 0.2 pada floating point bukan 0.3, dan
    // neraca saldo yang selisih beberapa sen tidak dapat dipertanggungjawabkan kepada pemeriksa.
    let total = 0n;
    for (let i = 0; i < 10_000; i += 1) total += parseAmount("0.10");
    expect(formatAmount(total)).toBe("1000.00");
  });

  it("menolak nominal yang lebih rinci dari sen atau bukan angka", () => {
    expect(() => parseAmount("10.005")).toThrow(/bukan angka Rupiah yang sah/);
    expect(() => parseAmount("1e5")).toThrow(/bukan angka Rupiah yang sah/);
    expect(() => parseAmount("")).toThrow(/bukan angka Rupiah yang sah/);
  });
});

describe("keseimbangan jurnal", () => {
  const belanjaSewa = [
    { accountCode: "6-1200", side: "DEBIT" as const, amount: "5000000.00" },
    { accountCode: "1-1110", side: "KREDIT" as const, amount: "5000000.00" },
  ];

  it("menerima jurnal yang debit dan kreditnya sama", () => {
    const summary = assertJournalIsPostable(belanjaSewa);
    expect(summary.balanced).toBe(true);
    expect(formatAmount(summary.totalDebit)).toBe("5000000.00");
  });

  it("menerima jurnal majemuk selama jumlah kedua sisinya sama", () => {
    const summary = assertJournalIsPostable([
      { accountCode: "1-1210", side: "DEBIT", amount: "15000000.00" },
      { accountCode: "1-1110", side: "KREDIT", amount: "14900000.00" },
      { accountCode: "7-1500", side: "KREDIT", amount: "100000.00" },
    ]);
    expect(summary.balanced).toBe(true);
  });

  it("menolak jurnal yang tidak seimbang dan menyebut selisihnya", () => {
    expect(() =>
      assertJournalIsPostable([
        { accountCode: "6-1200", side: "DEBIT", amount: "5000000.00" },
        { accountCode: "1-1110", side: "KREDIT", amount: "4500000.00" },
      ]),
    ).toThrow(/berbeda 500000.00/);
  });

  it("menolak jurnal berkaki tunggal", () => {
    expect(() => assertJournalIsPostable([{ accountCode: "6-1200", side: "DEBIT", amount: "5000000.00" }])).toThrow(
      /minimal dua baris/,
    );
  });

  it("menolak baris bernominal nol", () => {
    // Tanpa aturan ini, satu baris nol pada sisi lawan lolos sebagai jurnal "berpasangan".
    expect(() =>
      summariseJournal([
        { accountCode: "6-1200", side: "DEBIT", amount: "5000000.00" },
        { accountCode: "1-1110", side: "KREDIT", amount: "0.00" },
      ]),
    ).toThrow(/lebih besar dari nol/);
  });

  it("membalik sisi untuk jurnal koreksi", () => {
    expect(oppositeSide("DEBIT")).toBe("KREDIT");
    expect(oppositeSide("KREDIT")).toBe("DEBIT");
    const balik = belanjaSewa.map((line) => ({ ...line, side: oppositeSide(line.side) }));
    const gabungan = buildTrialBalance(
      [...belanjaSewa, ...balik].map((line) => ({ ...line, amount: parseAmount(line.amount) })),
    );
    // Jurnal beserta balikannya meniadakan diri: saldo kembali nol tanpa satu baris pun dihapus.
    expect(gabungan.rows.every((row) => row.debitBalance === 0n && row.creditBalance === 0n)).toBe(true);
    expect(gabungan.balanced).toBe(true);
  });
});

describe("arah saldo akun", () => {
  it("menghitung saldo searah saldo normal akunnya", () => {
    expect(accountBalance("DEBIT", parseAmount("10000.00"), parseAmount("2500.00"))).toBe(parseAmount("7500.00"));
    expect(accountBalance("KREDIT", parseAmount("2500.00"), parseAmount("10000.00"))).toBe(parseAmount("7500.00"));
  });

  it("memperlakukan akun lawan seperti akun biasa dengan saldo normal terbalik", () => {
    const akumulasiPenyusutan = findAccount("1-1520");
    expect(akumulasiPenyusutan?.contra).toBe(true);
    expect(akumulasiPenyusutan?.normalBalance).toBe("KREDIT");
    // Penyusutan bulan berjalan menaikkan akumulasi, bukan menurunkannya.
    expect(accountBalance("KREDIT", 0n, parseAmount("1000000.00"))).toBe(parseAmount("1000000.00"));
  });
});

describe("neraca saldo", () => {
  const lines = [
    { accountCode: "1-1110", side: "DEBIT" as const, amount: parseAmount("100000000.00") },
    { accountCode: "3-1100", side: "KREDIT" as const, amount: parseAmount("100000000.00") },
    { accountCode: "6-1200", side: "DEBIT" as const, amount: parseAmount("5000000.00") },
    { accountCode: "1-1110", side: "KREDIT" as const, amount: parseAmount("5000000.00") },
  ];

  it("menjumlahkan mutasi tiap akun dan menempatkan sisanya pada satu sisi", () => {
    const trial = buildTrialBalance(lines);
    const kas = trial.rows.find((row) => row.accountCode === "1-1110")!;
    expect(formatAmount(kas.totalDebit)).toBe("100000000.00");
    expect(formatAmount(kas.totalCredit)).toBe("5000000.00");
    expect(formatAmount(kas.debitBalance)).toBe("95000000.00");
    expect(kas.creditBalance).toBe(0n);
  });

  it("selalu seimbang bila setiap jurnalnya seimbang", () => {
    const trial = buildTrialBalance(lines);
    expect(trial.balanced).toBe(true);
    expect(formatAmount(trial.totalDebit)).toBe("100000000.00");
    expect(formatAmount(trial.totalDebit)).toBe(formatAmount(trial.totalCredit));
  });

  it("mengurutkan akun mengikuti kode, bukan urutan pencatatan", () => {
    const trial = buildTrialBalance([...lines].reverse());
    expect(trial.rows.map((row) => row.accountCode)).toEqual(["1-1110", "3-1100", "6-1200"]);
  });

  it("tidak memunculkan akun tanpa mutasi", () => {
    expect(buildTrialBalance(lines).rows.some((row) => row.accountCode === "8-1100")).toBe(false);
  });

  it("menambahkan saldo sebelum periode ke saldo akhir", () => {
    // Tanpa saldo awal, akun neraca hanya menunjukkan pergerakan sebulan: modal disetor bulan lalu
    // lenyap dari neraca bulan ini dan angkanya tidak dapat dipakai sebagai isian B0002.
    const sebelumnya = [
      { accountCode: "1-1110", side: "DEBIT" as const, amount: parseAmount("500000000.00") },
      { accountCode: "3-1100", side: "KREDIT" as const, amount: parseAmount("500000000.00") },
    ];
    const bulanIni = [
      { accountCode: "6-1200", side: "DEBIT" as const, amount: parseAmount("12000000.00") },
      { accountCode: "1-1110", side: "KREDIT" as const, amount: parseAmount("12000000.00") },
    ];
    const trial = buildTrialBalance(bulanIni, sebelumnya);
    const kas = trial.rows.find((row) => row.accountCode === "1-1110")!;
    expect(formatAmount(kas.openingBalance)).toBe("500000000.00");
    expect(formatAmount(kas.totalCredit)).toBe("12000000.00");
    expect(formatAmount(kas.debitBalance)).toBe("488000000.00");
  });

  it("tetap seimbang setelah saldo awal diikutkan", () => {
    // Saldo awal diikutkan untuk seluruh akun, bukan hanya akun neraca; menyaringnya ke akun neraca
    // saja membuat kedua sisi berselisih persis sebesar laba periode sebelumnya.
    const sebelumnya = [
      { accountCode: "1-1110", side: "DEBIT" as const, amount: parseAmount("500000000.00") },
      { accountCode: "4-1100", side: "KREDIT" as const, amount: parseAmount("500000000.00") },
    ];
    const trial = buildTrialBalance(
      [
        { accountCode: "6-1200", side: "DEBIT" as const, amount: parseAmount("12000000.00") },
        { accountCode: "1-1110", side: "KREDIT" as const, amount: parseAmount("12000000.00") },
      ],
      sebelumnya,
    );
    expect(trial.balanced).toBe(true);
  });

  it("memunculkan akun yang hanya bersaldo awal tanpa mutasi periode ini", () => {
    const trial = buildTrialBalance([], [
      { accountCode: "1-1110", side: "DEBIT" as const, amount: parseAmount("500000000.00") },
      { accountCode: "3-1100", side: "KREDIT" as const, amount: parseAmount("500000000.00") },
    ]);
    expect(trial.rows.map((row) => row.accountCode)).toEqual(["1-1110", "3-1100"]);
    expect(formatAmount(trial.totalDebit)).toBe("500000000.00");
  });
});

describe("saldo awal periode berikutnya", () => {
  it("membawa saldo akun neraca dan menolkan akun laba rugi", () => {
    // Tanpa pembedaan ini, beban bulan lalu terus muncul pada laporan bulan berjalan.
    expect(carryForwardBalance("ASET", parseAmount("95000000.00"))).toBe(parseAmount("95000000.00"));
    expect(carryForwardBalance("EKUITAS", parseAmount("100000000.00"))).toBe(parseAmount("100000000.00"));
    expect(carryForwardBalance("BEBAN", parseAmount("5000000.00"))).toBe(0n);
    expect(carryForwardBalance("PENDAPATAN", parseAmount("7000000.00"))).toBe(0n);
  });
});

describe("bagan akun", () => {
  it("tidak memiliki kode ganda", () => {
    const codes = CHART_OF_ACCOUNTS.map((account) => account.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("memetakan setiap akun ke sedikitnya satu form pelaporan", () => {
    // Inilah yang menjawab temuan 7.1: tiap pos laporan dapat ditelusuri ke akun buku besarnya.
    for (const account of CHART_OF_ACCOUNTS) {
      expect(account.forms.length, `akun ${account.code} tidak terpetakan ke form mana pun`).toBeGreaterThan(0);
    }
  });

  it("memiliki persis sembilan baris beban operasional seperti B0003", () => {
    const beban = CHART_OF_ACCOUNTS.filter((account) => account.type === "BEBAN");
    expect(beban).toHaveLength(9);
    expect(beban.every((account) => account.forms.includes("B0003"))).toBe(true);
  });

  it("menempatkan akun neraca dan akun laba rugi pada kelompok yang benar", () => {
    expect(isBalanceSheetAccount("ASET")).toBe(true);
    expect(isBalanceSheetAccount("KEWAJIBAN")).toBe(true);
    expect(isBalanceSheetAccount("EKUITAS")).toBe(true);
    expect(isBalanceSheetAccount("BEBAN")).toBe(false);
    expect(isBalanceSheetAccount("PENDAPATAN")).toBe(false);
    expect(isBalanceSheetAccount("HARGA_POKOK")).toBe(false);
    expect(isBalanceSheetAccount("PAJAK")).toBe(false);
  });

  it("memakai kode akun yang konsisten dengan kelompoknya", () => {
    const prefixByType: Record<string, string> = {
      ASET: "1", KEWAJIBAN: "2", EKUITAS: "3", PENDAPATAN: "4",
      HARGA_POKOK: "5", BEBAN: "6", LAIN_LAIN: "7", PAJAK: "8",
    };
    for (const account of CHART_OF_ACCOUNTS) {
      expect(account.code.startsWith(prefixByType[account.type]), `akun ${account.code} salah kelompok`).toBe(true);
    }
  });
});

describe("hari kalender dan batas periode", () => {
  it("membaca hari kalender dari tanggal maupun teks", () => {
    expect(isoDay(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
    expect(isoDay("2026-09-01")).toBe("2026-09-01");
    expect(isoDay("2026-09-01T13:45:00.000Z")).toBe("2026-09-01");
  });

  it("menghitung batas bulan tanpa terpengaruh zona waktu proses", () => {
    // Regresi: aritmetika bulan yang memakai getter UTC atas tanggal tengah malam waktu lokal
    // membuat 1 September jatuh ke periode Agustus di GMT+7, sehingga jurnal hari pertama hilang
    // dari laporan bulannya sendiri.
    expect(monthStartIso("2026-09-01")).toBe("2026-09-01");
    expect(monthEndIso("2026-09-01")).toBe("2026-09-30");
    expect(monthStartIso("2026-09-30")).toBe("2026-09-01");
    expect(monthEndIso(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-30");
  });

  it("mengetahui panjang bulan yang berbeda-beda, termasuk Februari kabisat", () => {
    expect(monthEndIso("2026-02-10")).toBe("2026-02-28");
    expect(monthEndIso("2028-02-10")).toBe("2028-02-29");
    expect(monthEndIso("2026-01-31")).toBe("2026-01-31");
    expect(monthEndIso("2026-12-01")).toBe("2026-12-31");
  });
});

describe("rekonsiliasi kas buku besar terhadap kas operasional", () => {
  it("menyatakan cocok ketika selisihnya persis sebesar isi brankas", () => {
    // 1-1110 pada buku besar memuat seluruh kas milik sendiri; cash_balances hanya memuat laci.
    // Selisih keduanya karena itu harus sama dengan akumulasi SAFE_DEPOSIT dikurangi SAFE_WITHDRAWAL.
    expect(reconcileCash({ ledgerCashIdr: "150000000.00", operationalCashIdr: "100000000.00", safeBalanceIdr: "50000000.00" }))
      .toEqual({ difference: "0.00", reconciled: true });
  });

  it("menunjukkan selisih yang tidak dapat dijelaskan brankas", () => {
    expect(reconcileCash({ ledgerCashIdr: "150000000.00", operationalCashIdr: "100000000.00", safeBalanceIdr: "40000000.00" }))
      .toEqual({ difference: "10000000.00", reconciled: false });
  });
});
