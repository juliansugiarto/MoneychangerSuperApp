import { describe, expect, it } from "vitest";
import { compareDenominationCounts } from "./denominationVariance";

const rowFor = (result: ReturnType<typeof compareDenominationCounts>, value: string) =>
  result.rows.find((row) => row.value === value);

describe("compareDenominationCounts", () => {
  it("menyatakan cocok ketika kedua sisi sama persis", () => {
    const result = compareDenominationCounts(
      [{ value: "100000", quantity: 5 }, { value: "50000", quantity: 3 }],
      [{ value: "100000", quantity: 5 }, { value: "50000", quantity: 3 }],
    );

    expect(result.hasVariance).toBe(false);
    expect(result.rows.every((row) => row.difference === 0)).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it("memunculkan pecahan yang hanya ada di tangan petugas sebagai selisih, bukan membuangnya", () => {
    const result = compareDenominationCounts(
      [{ value: "100000", quantity: 5 }],
      [{ value: "100000", quantity: 5 }, { value: "20000", quantity: 2 }],
    );

    expect(result.hasVariance).toBe(true);
    expect(rowFor(result, "20000.000000")).toEqual({
      value: "20000.000000",
      systemQuantity: 0,
      physicalQuantity: 2,
      difference: 2,
    });
  });

  it("memunculkan pecahan yang ada di sistem tetapi tidak terhitung fisik", () => {
    const result = compareDenominationCounts(
      [{ value: "100000", quantity: 5 }, { value: "5000", quantity: 4 }],
      [{ value: "100000", quantity: 5 }],
    );

    expect(result.hasVariance).toBe(true);
    expect(rowFor(result, "5000.000000")).toEqual({
      value: "5000.000000",
      systemQuantity: 4,
      physicalQuantity: 0,
      difference: -4,
    });
  });

  it("tetap menyalakan varians ketika totalnya sama tetapi komposisinya berbeda", () => {
    // Keputusan 2 pada spec: sistem 5x100.000 dan fisik 10x50.000 sama-sama Rp 500.000, dan justru
    // itulah celah yang paket ini tutup — total yang cocok tidak boleh membungkam selisih komposisi.
    const result = compareDenominationCounts(
      [{ value: "100000", quantity: 5 }],
      [{ value: "50000", quantity: 10 }],
    );

    expect(result.hasVariance).toBe(true);
    expect(rowFor(result, "100000.000000")?.difference).toBe(-5);
    expect(rowFor(result, "50000.000000")?.difference).toBe(10);
  });

  it("memperlakukan nilai yang sama dengan penulisan berbeda sebagai satu pecahan", () => {
    const result = compareDenominationCounts(
      [{ value: "100000", quantity: 5 }],
      [{ value: "100000.000000", quantity: 5 }],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.hasVariance).toBe(false);
    expect(result.rows[0]).toEqual({
      value: "100000.000000",
      systemQuantity: 5,
      physicalQuantity: 5,
      difference: 0,
    });
  });

  it("mengurutkan barisnya dari pecahan terbesar ke terkecil", () => {
    const result = compareDenominationCounts(
      [{ value: "1000", quantity: 1 }, { value: "100000", quantity: 1 }, { value: "20000", quantity: 1 }],
      [],
    );

    expect(result.rows.map((row) => row.value)).toEqual(["100000.000000", "20000.000000", "1000.000000"]);
  });

  it("menjumlahkan baris berulang pada sisi yang sama, bukan menimpanya", () => {
    // Sisi mana pun boleh datang sebagai beberapa baris untuk satu pecahan; menimpa akan diam-diam
    // menghilangkan uang yang sudah dihitung.
    const result = compareDenominationCounts(
      [{ value: "50000", quantity: 2 }, { value: "50000", quantity: 3 }],
      [{ value: "50000", quantity: 5 }],
    );

    expect(result.hasVariance).toBe(false);
    expect(rowFor(result, "50000.000000")?.systemQuantity).toBe(5);
  });

  it("menyatakan cocok ketika kedua sisi kosong — brankas yang memang kosong", () => {
    const result = compareDenominationCounts([], []);

    expect(result.rows).toEqual([]);
    expect(result.hasVariance).toBe(false);
  });
});
