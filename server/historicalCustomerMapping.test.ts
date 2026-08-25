import { describe, expect, it } from "vitest";
import { buildUniqueNameIndex, normalizeHistoricalCustomerName, resolveHistoricalCustomer } from "../scripts/historicalCustomerMapping.mjs";

describe("historical customer mapping", () => {
  it("menormalkan variasi penulisan nama dan memperkaya hanya kandidat yang unik", () => {
    const source = { source_key: "HIST-CUSTOMER-KTP:hash", full_name: "Nama, Nasabah" };
    const historicalCustomer = { id: 4, fullName: "Nama Nasabah", historicalSourceKey: "HIST-CUSTOMER:legacy" };
    const bySource = new Map();
    const byName = buildUniqueNameIndex([historicalCustomer], "fullName");

    expect(normalizeHistoricalCustomerName(source.full_name)).toBe("nama nasabah");
    expect(resolveHistoricalCustomer(source, bySource, byName)).toEqual({
      existingCustomer: historicalCustomer,
      matchType: "UNIQUE_NAME",
    });
  });

  it("menolak kecocokan nama ambigu agar identitas tidak dipasangkan keliru", () => {
    const source = { source_key: "HIST-CUSTOMER-KTP:hash", full_name: "Nama Nasabah" };
    const byName = buildUniqueNameIndex([{ id: 4, fullName: "Nama Nasabah" }, { id: 5, fullName: "Nama Nasabah" }], "fullName");

    expect(resolveHistoricalCustomer(source, new Map(), byName)).toEqual({
      existingCustomer: null,
      matchType: "AMBIGUOUS_NAME",
    });
  });
});
