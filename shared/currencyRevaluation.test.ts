import { describe, expect, it } from "vitest";
import { CASH_ACCOUNTS, snapshotOnOrBefore, valueMonetaryBalance } from "./currencyRevaluation";

describe("snapshotOnOrBefore", () => {
  const rows = [
    { referenceDate: "2026-09-30", id: 3 },
    { referenceDate: "2026-09-28", id: 2 },
    { referenceDate: "2026-08-31", id: 1 },
  ];

  it("memilih snapshot tepat pada tanggalnya", () => {
    expect(snapshotOnOrBefore(rows, "2026-09-30")?.id).toBe(3);
  });

  it("mundur ke snapshot terakhir sebelum tanggalnya", () => {
    // BI tidak mengumumkan kurs pada Sabtu, Minggu, dan hari libur. Mundur adalah keadaan sah.
    expect(snapshotOnOrBefore(rows, "2026-09-29")?.id).toBe(2);
  });

  it("tidak pernah memakai snapshot yang melewati tanggalnya", () => {
    expect(snapshotOnOrBefore(rows, "2026-08-31")?.id).toBe(1);
    expect(snapshotOnOrBefore(rows, "2026-08-30")).toBeNull();
  });

  it("mengembalikan null bila tidak ada satu pun", () => {
    expect(snapshotOnOrBefore([], "2026-09-30")).toBeNull();
  });

  it("tidak bergantung pada urutan masukannya", () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(snapshotOnOrBefore(shuffled, "2026-09-29")?.id).toBe(2);
  });
});

describe("valueMonetaryBalance", () => {
  it("mengalikan saldo valuta dengan kurs tengah", () => {
    expect(valueMonetaryBalance({ foreignBalance: "1000.000000", midRatePerUnit: "16300.000000000000" }))
      .toBe("16300000.00");
  });

  it("membulatkan setengah-ke-atas ke sen", () => {
    expect(valueMonetaryBalance({ foreignBalance: "1.000000", midRatePerUnit: "16300.125000000000" }))
      .toBe("16300.13");
  });

  it("menerima saldo nol", () => {
    expect(valueMonetaryBalance({ foreignBalance: "0.000000", midRatePerUnit: "16300.000000000000" }))
      .toBe("0.00");
  });

  it("menerima saldo negatif tanpa membalik tandanya", () => {
    // Rekening yang tercatat minus adalah kekeliruan data, bukan urusan fungsi ini — ia mengukur,
    // bukan menghakimi.
    expect(valueMonetaryBalance({ foreignBalance: "-100.000000", midRatePerUnit: "16300.000000000000" }))
      .toBe("-1630000.00");
  });

  it("menolak masukan yang bukan angka dengan menyebut medannya", () => {
    expect(() => valueMonetaryBalance({ foreignBalance: "", midRatePerUnit: "1" }))
      .toThrow(/saldo valuta/i);
    expect(() => valueMonetaryBalance({ foreignBalance: "1", midRatePerUnit: "bukan angka" }))
      .toThrow(/kurs tengah/i);
  });
});

describe("CASH_ACCOUNTS", () => {
  it("memuat kas Rupiah, bank Rupiah, dan bank valuta asing — bukan kas UKA fisik", () => {
    // 1-1210 adalah persediaan, dinilai lewat 5-1300 pada paket C. Memasukkannya ke kas akan
    // menghitung pergerakan yang sama dua kali pada Arus Kas paket F2.
    expect(CASH_ACCOUNTS).toEqual(["1-1110", "1-1120", "1-1220"]);
  });
});
