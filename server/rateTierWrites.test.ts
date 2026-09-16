import { describe, expect, it } from "vitest";
import { assertTierSaveValid, planTierDeactivation } from "./rateBoard";
import type { RateTierRow } from "../shared/rateTiers";

const tier = (id: number, label: string, values: string[], sortOrder = id, active = true): RateTierRow =>
  ({ id, currencyId: 1, label, denominationValues: values, sortOrder, active });

describe("menyimpan kelompok pecahan", () => {
  it("menolak nilai muka yang sudah dimiliki kelompok aktif lain dan menyebut kedua labelnya", () => {
    expect(() => assertTierSaveValid([tier(1, "100", ["100"])], { currencyId: 1, label: "besar", denominationValues: ["100", "50"], sortOrder: 2 }))
      .toThrow(/100(\.0+)?.*(100|besar).*(100|besar)/);
  });

  it("menerima perubahan pada kelompok yang sama tanpa menganggapnya tumpang tindih dengan dirinya", () => {
    const next = assertTierSaveValid([tier(1, "100", ["100"])], { tierId: 1, currencyId: 1, label: "100", denominationValues: ["100"], sortOrder: 1 });
    expect(next).toHaveLength(1);
    expect(next[0].denominationValues).toEqual(["100.000000"]);
  });

  it("menormalkan nilai muka dan membuang duplikat di dalam satu kelompok", () => {
    const next = assertTierSaveValid([], { currencyId: 1, label: "5–20", denominationValues: ["5", "10", "10", "20"], sortOrder: 1 });
    expect(next[0].denominationValues).toEqual(["5.000000", "10.000000", "20.000000"]);
  });

  it("menolak kelompok tanpa satu pun nilai muka", () => {
    expect(() => assertTierSaveValid([], { currencyId: 1, label: "kosong", denominationValues: [], sortOrder: 1 }))
      .toThrow(/minimal satu nilai pecahan/i);
  });
});

describe("menonaktifkan kelompok pecahan", () => {
  it("mewajibkan alasan ketika kelompoknya masih memiliki kurs aktif", () => {
    expect(() => planTierDeactivation({ tierLabel: "100", activeRateIds: [7], reason: "salah" }))
      .toThrow(/alasan.*10 karakter/i);
  });

  it("me-RETIRE kurs aktif kelompok itu dalam rencana yang sama", () => {
    expect(planTierDeactivation({ tierLabel: "100", activeRateIds: [7, 9], reason: "Kelompok 100 digabung ke kelompok besar." }))
      .toEqual({ retireRateIds: [7, 9], reason: "Kelompok 100 digabung ke kelompok besar." });
  });

  it("tidak menuntut alasan bila kelompoknya belum pernah punya kurs aktif", () => {
    expect(planTierDeactivation({ tierLabel: "50", activeRateIds: [], reason: "" })).toEqual({ retireRateIds: [], reason: "" });
  });
});
