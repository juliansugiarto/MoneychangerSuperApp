import { describe, expect, it } from "vitest";
import { buildSipesatCsv, buildSipesatInitialFileName, buildSipesatTriwulanFileName, SIPESAT_CSV_HEADER } from "../shared/sipesatExport";

describe("SIPESAT_CSV_HEADER", () => {
  it("matches the header PPATK publishes on the SIPESAT sample data page exactly", () => {
    expect(SIPESAT_CSV_HEADER.join("|")).toBe("IDPJK|Kode Nasabah|Nama Nasabah|Tempat Lahir|Tanggal Lahir|Alamat|No.KTP|No.Identitas Lain|No.CIF|No.NPWP");
  });
});

describe("buildSipesatCsv", () => {
  it("reproduces the shape of PPATK's own published sample rows (individual with KTP, corporate with no birth data)", () => {
    const rows = [
      { id: 1, fullName: "Iwan Kalila", placeOfBirth: "Jakarta", dateOfBirth: "2002-04-17", address: "Jl. Ir. H. Juanda No. 35", identityType: "KTP" as const, identityNumber: "3256170420020005", cifNumber: "J35001" },
      { id: 2, fullName: "PT ATK", placeOfBirth: null, dateOfBirth: null, address: "Jl. Ir. H. Juanda No. 35A", identityType: "OTHER" as const, identityNumber: "", cifNumber: "J35002" },
    ];
    const csv = buildSipesatCsv("123", rows);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(SIPESAT_CSV_HEADER.join("|"));
    expect(lines[1]).toBe("123|1|Iwan Kalila|Jakarta|17-04-2002|Jl. Ir. H. Juanda No. 35|3256170420020005||J35001|");
    expect(lines[2]).toBe("123|2|PT ATK|||Jl. Ir. H. Juanda No. 35A|||J35002|");
  });

  it("puts a passport/other identity number under No.Identitas Lain, never under No.KTP", () => {
    const csv = buildSipesatCsv("123", [{ id: 5, fullName: "John Traveler", placeOfBirth: "Singapore", dateOfBirth: "1990-01-05", address: "Hotel X", identityType: "PASSPORT" as const, identityNumber: "A1234567", cifNumber: "J35010" }]);
    const [, row] = csv.trim().split("\r\n");
    const fields = row.split("|");
    expect(fields[6]).toBe(""); // No.KTP
    expect(fields[7]).toBe("A1234567"); // No.Identitas Lain
  });

  it("strips a stray pipe character from free-text fields so it can never break column alignment", () => {
    const csv = buildSipesatCsv("123", [{ id: 9, fullName: "Budi | Santoso", placeOfBirth: null, dateOfBirth: null, address: "Jl. A", identityType: "KTP" as const, identityNumber: "123", cifNumber: "J1" }]);
    const [, row] = csv.trim().split("\r\n");
    expect(row.split("|")).toHaveLength(10);
  });
});

describe("SIPESAT file naming", () => {
  it("builds the initial-data file name per the user manual: SIPESAT_IDPJK_IN_DDMMYYYY_NO.csv", () => {
    expect(buildSipesatInitialFileName("1000031", new Date(2025, 0, 14), 1)).toBe("SIPESAT_1000031_IN_14012025_1.csv");
  });

  it("builds the quarterly file name per the user manual: SIPESAT_IDPJK_TW_XYYYY_DDMMYYYY_NO.csv", () => {
    expect(buildSipesatTriwulanFileName("1000090", 4, 2016, new Date(2025, 0, 15), 1)).toBe("SIPESAT_1000090_TW_42016_15012025_1.csv");
  });
});
