import { describe, expect, it, vi } from "vitest";
import { CHART_OF_ACCOUNTS } from "../shared/chartOfAccounts";
import { isSkipped, mapBankMovement, mapCashMovement, type MappingResult } from "../shared/journalMapping";
import { assertJournalIsPostable } from "../shared/ledger";
import * as db from "./db";
import * as ledgerOperations from "./ledgerOperations";
import { postCashMovements } from "./ledgerPosting";

const linesOf = (result: MappingResult) => {
  if (isSkipped(result)) throw new Error(`tidak terpetakan: ${result.skipped}`);
  return result.lines;
};
const reasonOf = (result: MappingResult) => {
  if (!isSkipped(result)) throw new Error("seharusnya dilewati, tetapi justru terpetakan");
  return result.skipped;
};
const knownCodes = new Set(CHART_OF_ACCOUNTS.map((account) => account.code));

const kas = (over: Partial<Parameters<typeof mapCashMovement>[0]> = {}) => ({
  category: "CAPITAL_INJECTION" as const, amount: "500000000.000000", currencyCode: "IDR",
  reason: "Setoran modal awal", isFirstMovementForCurrency: false, ...over,
});

describe("pemetaan mutasi kas", () => {
  it("mencatat setoran modal sebagai penambahan kas dan modal disetor", () => {
    expect(linesOf(mapCashMovement(kas()))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "500000000.00", memo: "Setoran modal awal" },
      { accountCode: "3-1100", side: "KREDIT", amount: "500000000.00", memo: "Setoran modal awal" },
    ]);
  });

  it("mencatat penarikan pemilik sebagai prive/dividen, bukan pengurangan modal disetor", () => {
    // Keputusan pengguna 4 September 2026: penarikan adalah distribusi ke pemilik, dan Modal
    // Disetor tetap utuh supaya jejak setoran modal tidak terhapus oleh penarikan.
    const lines = linesOf(mapCashMovement(kas({ category: "CAPITAL_WITHDRAWAL", amount: "10000000.000000", reason: "Penarikan pemilik" })));
    expect(lines).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "10000000.00", memo: "Penarikan pemilik" },
      { accountCode: "1-1110", side: "KREDIT", amount: "10000000.00", memo: "Penarikan pemilik" },
    ]);
  });

  it("memindahkan kas ke bank tanpa mengubah total aset", () => {
    expect(linesOf(mapCashMovement(kas({ category: "BANK_DEPOSIT", amount: "25000000.000000", reason: "Setor ke BCA" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "25000000.00", memo: "Setor ke BCA" },
      { accountCode: "1-1110", side: "KREDIT", amount: "25000000.00", memo: "Setor ke BCA" },
    ]);
  });

  it("memindahkan bank ke kas dengan arah terbalik", () => {
    expect(linesOf(mapCashMovement(kas({ category: "BANK_WITHDRAWAL", amount: "25000000.000000", reason: "Tarik dari BCA" })))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "25000000.00", memo: "Tarik dari BCA" },
      { accountCode: "1-1120", side: "KREDIT", amount: "25000000.00", memo: "Tarik dari BCA" },
    ]);
  });

  it("mencatat kas lebih pada pembukaan sebagai pendapatan lain-lain", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "50000.000000", reason: "OPENING_CASH_2026-09-04_IDR" })))).toEqual([
      { accountCode: "1-1110", side: "DEBIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
      { accountCode: "7-1900", side: "KREDIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
    ]);
  });

  it("membalik arah untuk kas kurang pada pembukaan", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "-50000.000000", reason: "OPENING_CASH_2026-09-04_IDR" })))).toEqual([
      { accountCode: "7-1900", side: "DEBIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
      { accountCode: "1-1110", side: "KREDIT", amount: "50000.00", memo: "OPENING_CASH_2026-09-04_IDR" },
    ]);
  });

  it("menolak menjurnal kas awal pertama, karena asal uangnya belum tercatat", () => {
    // Menjurnalnya ke 7-1900 akan mencatat modal pemilik sebagai pendapatan lain-lain dan
    // menggelembungkan laba. Sistem menolak menebak justru di titik yang paling mahal.
    const reason = reasonOf(mapCashMovement(kas({ category: "OPENING", amount: "500000000.000000", isFirstMovementForCurrency: true })));
    expect(reason).toMatch(/setoran modal/i);
  });

  it("tetap menjurnal kas kurang meski itu mutasi pertama, karena bukan uang masuk tanpa asal", () => {
    expect(linesOf(mapCashMovement(kas({ category: "OPENING", amount: "-25000.000000", isFirstMovementForCurrency: true })))).toHaveLength(2);
  });

  it.each([
    ["TRANSACTION", /bon/i],
    ["SAFE_DEPOSIT", /brankas/i],
    ["SAFE_WITHDRAWAL", /brankas/i],
    ["DENOMINATION_EXCHANGE", /nol/i],
    ["OFF_HOURS_SALE", /bon/i],
    ["OTHER", /menebak/i],
  ] as const)("melewati kategori %s dengan alasan yang dapat dibaca", (category, pattern) => {
    expect(reasonOf(mapCashMovement(kas({ category })))).toMatch(pattern);
  });

  it("melewati mutasi valuta asing, karena persediaan periodik menilainya di akhir periode", () => {
    expect(reasonOf(mapCashMovement(kas({ currencyCode: "USD" })))).toMatch(/periodik|akhir periode/i);
  });

  it("melewati mutasi bernilai nol", () => {
    expect(reasonOf(mapCashMovement(kas({ category: "OPENING", amount: "0.000000" })))).toMatch(/nol|selisih/i);
  });

  it("menolak membulatkan uang alih-alih menjurnal nominal di bawah sen", () => {
    expect(reasonOf(mapCashMovement(kas({ amount: "1000.001234" })))).toMatch(/pembulatan|sen/i);
  });

  it("selalu menghasilkan jurnal seimbang dengan akun yang ada di bagan akun", () => {
    const categories = ["CAPITAL_INJECTION", "CAPITAL_WITHDRAWAL", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "OPENING"] as const;
    for (const category of categories) {
      const lines = linesOf(mapCashMovement(kas({ category, amount: "1234567.890000" })));
      expect(() => assertJournalIsPostable(lines)).not.toThrow();
      for (const line of lines) expect(knownCodes.has(line.accountCode)).toBe(true);
    }
  });
});

describe("pemetaan mutasi bank", () => {
  const bank = (over: Partial<Parameters<typeof mapBankMovement>[0]> = {}) => ({
    category: "OPENING" as const, direction: "ADJUSTMENT" as const, amount: "100000000.000000",
    currencyCode: "IDR", reason: "Saldo awal rekening BCA 123", ...over,
  });

  it("mencatat saldo pembukaan rekening sebagai modal disetor", () => {
    // Berbeda dari kas: rekening bank dibuat sekali dan tidak mengenal salah hitung fisik, jadi
    // saldo pembukaannya tidak ambigu.
    expect(linesOf(mapBankMovement(bank()))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
      { accountCode: "3-1100", side: "KREDIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
    ]);
  });

  it("mencatat setoran modal langsung ke rekening", () => {
    expect(linesOf(mapBankMovement(bank({ category: "CAPITAL_INJECTION", direction: "IN", amount: "5000000.000000", reason: "Setoran modal via transfer" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "5000000.00", memo: "Setoran modal via transfer" },
      { accountCode: "3-1100", side: "KREDIT", amount: "5000000.00", memo: "Setoran modal via transfer" },
    ]);
  });

  it("mencatat penarikan pemilik dari rekening sebagai prive/dividen", () => {
    expect(linesOf(mapBankMovement(bank({ category: "CAPITAL_WITHDRAWAL", direction: "OUT", amount: "5000000.000000", reason: "Penarikan pemilik" })))).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "5000000.00", memo: "Penarikan pemilik" },
      { accountCode: "1-1120", side: "KREDIT", amount: "5000000.00", memo: "Penarikan pemilik" },
    ]);
  });

  it("melewati sisi bank dari pemindahan kas, karena sisi kasnya sudah menjurnalnya", () => {
    expect(reasonOf(mapBankMovement(bank({ category: "CASH_TRANSFER", direction: "IN" })))).toMatch(/sisi kas/i);
  });

  it.each([
    ["TRANSACTION", /bon/i],
    ["ADJUSTMENT", /menebak|bebas/i],
    ["OTHER", /menebak|bebas/i],
  ] as const)("melewati kategori bank %s dengan alasan", (category, pattern) => {
    expect(reasonOf(mapBankMovement(bank({ category, direction: "IN" })))).toMatch(pattern);
  });

  it("menjurnal rekening valuta asing ke 1-1220 memakai nilai Rupiah yang dipasok", () => {
    // Rekening bank valuta asing adalah pos moneter, bukan persediaan: nilainya masuk buku besar
    // pada kurs tanggal mutasi, lalu diretranslasi pada kurs penutup tiap akhir periode.
    expect(linesOf(mapBankMovement(bank({
      category: "CAPITAL_INJECTION", direction: "IN",
      amount: "1000.000000", currencyCode: "USD", rupiahAmount: "16300000.00",
      reason: "Setoran modal USD",
    })))).toEqual([
      { accountCode: "1-1220", side: "DEBIT", amount: "16300000.00", memo: "Setoran modal USD", currencyCode: "USD", foreignAmount: "1000.000000" },
      { accountCode: "3-1100", side: "KREDIT", amount: "16300000.00", memo: "Setoran modal USD" },
    ]);
  });

  it("memakai 1-1220 pada sisi kredit untuk penarikan pemilik dari rekening valuta asing", () => {
    expect(linesOf(mapBankMovement(bank({
      category: "CAPITAL_WITHDRAWAL", direction: "OUT",
      amount: "500.000000", currencyCode: "USD", rupiahAmount: "8150000.00",
      reason: "Penarikan pemilik USD",
    })))).toEqual([
      { accountCode: "3-4100", side: "DEBIT", amount: "8150000.00", memo: "Penarikan pemilik USD" },
      { accountCode: "1-1220", side: "KREDIT", amount: "8150000.00", memo: "Penarikan pemilik USD", currencyCode: "USD", foreignAmount: "500.000000" },
    ]);
  });

  it("melewati mutasi valuta asing yang kursnya belum tersedia, beserta jalan keluarnya", () => {
    // Menebak kurs jauh lebih buruk daripada tidak menjurnalnya: angka yang salah di buku besar
    // tidak pernah ditinjau lagi, sedangkan baris `skipped` terlihat pada ringkasan penjurnalan.
    expect(reasonOf(mapBankMovement(bank({
      category: "CAPITAL_INJECTION", direction: "IN",
      amount: "1000.000000", currencyCode: "USD",
      reason: "Setoran modal USD",
    })))).toMatch(/kurs BI pada tanggal mutasi belum tersedia/i);
  });

  it("tidak mengubah perilaku rekening IDR meski nilai Rupiah ikut dipasok", () => {
    // `rupiahAmount` hanya untuk rekening non-IDR; nominal rekening Rupiah sudah ada pada `amount`.
    expect(linesOf(mapBankMovement(bank({ rupiahAmount: "999.99" })))).toEqual([
      { accountCode: "1-1120", side: "DEBIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
      { accountCode: "3-1100", side: "KREDIT", amount: "100000000.00", memo: "Saldo awal rekening BCA 123" },
    ]);
  });

  it("tidak menandai baris rekening IDR dengan mata uang", () => {
    // Penanda valuta hanya untuk baris 1-1220. Menandai baris Rupiah akan membuat revaluasi
    // menghitungnya sebagai pos moneter valuta asing.
    for (const line of linesOf(mapBankMovement(bank()))) {
      expect(line.currencyCode).toBeUndefined();
      expect(line.foreignAmount).toBeUndefined();
    }
  });

  it("melewati kategori yang tidak dapat dipetakan sebelum menuntut kurs", () => {
    // Mutasi bon valuta asing tetap dilewati karena bonnya sendiri sudah menjurnalnya — bukan
    // karena kursnya belum ada. Alasan yang benar penting: yang satu tidak perlu ditindaklanjuti,
    // yang lain menuntut sinkronisasi kurs.
    expect(reasonOf(mapBankMovement(bank({ category: "TRANSACTION", direction: "IN", currencyCode: "USD" })))).toMatch(/bon/i);
  });
});

describe("idempotensi posting mutasi kas", () => {
  it("melaporkan mutasi yang sudah pernah dijurnal sebagai alreadyPosted, tanpa menulis ulang", async () => {
    const movement = {
      id: 11,
      cashBalanceId: 1,
      category: "CAPITAL_INJECTION",
      amount: "500000000.000000",
      reason: "Setoran modal",
      createdAt: new Date("2026-09-04T03:00:00Z"),
      currencyCode: "IDR",
    };
    const chain = (rows: unknown[]): any => ({
      from: () => chain(rows),
      innerJoin: () => chain(rows),
      where: () => chain(rows),
      orderBy: () => chain(rows),
      limit: () => Promise.resolve(rows),
      then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
    });
    const fakeDb = {
      select: vi.fn((fields: Record<string, unknown>) => {
        if ("sourceReference" in fields) return chain([{ sourceReference: "KAS-11" }]); // sudah pernah dijurnal
        if (Object.keys(fields).length === 1) return chain([{ id: 11 }]);              // mutasi paling awal
        return chain([movement]);
      }),
    };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    const post = vi.spyOn(ledgerOperations, "postJournalEntry");

    const outcome = await postCashMovements({ from: new Date("2026-09-01"), to: new Date("2026-09-30") }, { id: 1 });

    expect(outcome.alreadyPosted).toEqual(["KAS-11"]);
    expect(outcome.posted).toEqual([]);
    expect(post).not.toHaveBeenCalled();
    getDb.mockRestore();
    post.mockRestore();
  });
});
