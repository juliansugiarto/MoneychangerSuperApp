import { describe, expect, it } from "vitest";
import {
  buildGoAmlLtkmReportXml,
  buildGoAmlLtktReportXml,
  buildPersonMyClientXml,
  escapeXml,
  formatSqlDate,
  formatSqlDecimal,
  normalizeNpwpForGoAml,
  toGoAmlContactType,
  toGoAmlGender,
  toGoAmlLtktReportCode,
  toGoAmlTransmodeCode,
  type GoAmlCustomer,
  type GoAmlLtkmLine,
  type GoAmlLtktLine,
} from "../shared/goAmlExport";

const baseCustomer: GoAmlCustomer = {
  fullName: "Budi Santoso",
  dateOfBirth: "1990-05-20T00:00:00.000Z",
  placeOfBirth: "Jakarta",
  gender: "MALE",
  nationality: "ID",
  address: "Jl. Sudirman No. 1",
  addressType: "RUMAH",
  addressCountry: "ID",
  addressProvince: "DKI Jakarta",
  addressCity: "Jakarta Selatan",
  addressDistrict: "Kebayoran Baru",
  addressPostalCode: "12190",
  phoneNumber: "+62 812-3456-7890",
  occupation: "Karyawan Swasta",
  sourceOfFunds: "Gaji bulanan",
  npwp: "12.345.678.9-012.000",
  identityType: "KTP",
  identityNumber: "3174000000000001",
  identityExpiryDate: null,
};

describe("goAML lookup-table mappings (verified against the XSD enums, not guessed)", () => {
  it("maps our MALE/FEMALE to goAML's gender_type M/F", () => {
    expect(toGoAmlGender("MALE")).toBe("M");
    expect(toGoAmlGender("FEMALE")).toBe("F");
  });

  it("maps address types to goAML's 3-value contact_type, with LAINNYA falling back to Rumah (no 4th code exists)", () => {
    expect(toGoAmlContactType("RUMAH")).toBe("R");
    expect(toGoAmlContactType("KANTOR")).toBe("K");
    expect(toGoAmlContactType("DOMISILI")).toBe("D");
    expect(toGoAmlContactType("LAINNYA")).toBe("R");
  });

  it("maps BUY/SELL to PBVAL/PJVAL transmode codes", () => {
    expect(toGoAmlTransmodeCode("BUY")).toBe("PBVAL");
    expect(toGoAmlTransmodeCode("SELL")).toBe("PJVAL");
  });

  it("maps BUY (Rupiah out) to LTKTK and SELL (Rupiah in) to LTKTM", () => {
    expect(toGoAmlLtktReportCode("BUY")).toBe("LTKTK");
    expect(toGoAmlLtktReportCode("SELL")).toBe("LTKTM");
  });
});

describe("normalizeNpwpForGoAml", () => {
  it("keeps a 15 or 16 digit NPWP after stripping punctuation", () => {
    expect(normalizeNpwpForGoAml("12.345.678.9-012.000")).toBe("123456789012000");
    expect(normalizeNpwpForGoAml("1234567890120001")).toBe("1234567890120001");
  });

  it("returns null for anything that isn't exactly 15 or 16 digits, rather than submitting malformed data", () => {
    expect(normalizeNpwpForGoAml("123")).toBeNull();
    expect(normalizeNpwpForGoAml(null)).toBeNull();
    expect(normalizeNpwpForGoAml(undefined)).toBeNull();
  });
});

describe("escapeXml", () => {
  it("escapes all five XML special characters", () => {
    expect(escapeXml(`Toko "A" & B's <shop>`)).toBe("Toko &quot;A&quot; &amp; B&apos;s &lt;shop&gt;");
  });
});

describe("formatSqlDate / formatSqlDecimal", () => {
  it("formats a date as goAML's dateTime lexical form (no timezone suffix)", () => {
    expect(formatSqlDate("2026-09-01T08:30:00.000Z")).toBe("2026-09-01T08:30:00");
  });

  it("rejects a non-numeric decimal string rather than emitting invalid XML", () => {
    expect(() => formatSqlDecimal("not-a-number")).toThrow();
  });

  it("passes through a valid plain decimal unchanged", () => {
    expect(formatSqlDecimal("500000000.00")).toBe("500000000.00");
    expect(formatSqlDecimal(1500.5)).toBe("1500.5");
  });
});

describe("buildPersonMyClientXml — element order matters (XSD sequences are order-sensitive)", () => {
  const xml = buildPersonMyClientXml(baseCustomer);

  it("emits elements in the exact xs:sequence order from t_person_my_client", () => {
    const order = ["<gender>", "<last_name>", "<birthdate>", "<birth_place>", "<nationality1>", "<residence>", "<phones>", "<addresses>", "<occupation>", "<identification>", "<tax_number>", "<tax_reg_number>", "<source_of_wealth>"];
    let cursor = -1;
    for (const tag of order) {
      const index = xml.indexOf(tag);
      expect(index, `${tag} should be present`).toBeGreaterThan(-1);
      expect(index, `${tag} should come after the previous element`).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("maps last_name from the full name (no first/last split) per the confirmed convention", () => {
    expect(xml).toContain("<last_name>Budi Santoso</last_name>");
  });

  it("uses tph_number (digits only), not a made-up phone_number tag", () => {
    expect(xml).toContain("<tph_number>6281234567890</tph_number>");
    expect(xml).not.toContain("phone_number>");
  });

  it("marks tax_reg_number Y and includes a normalized tax_number when NPWP is present", () => {
    expect(xml).toContain("<tax_number>123456789012000</tax_number>");
    expect(xml).toContain("<tax_reg_number>Y</tax_reg_number>");
  });

  it("marks tax_reg_number T and omits tax_number when NPWP is absent", () => {
    const withoutNpwp = buildPersonMyClientXml({ ...baseCustomer, npwp: null });
    expect(withoutNpwp).not.toContain("<tax_number>");
    expect(withoutNpwp).toContain("<tax_reg_number>T</tax_reg_number>");
  });

  it("includes a KTP identification block with issue_country ID (KTP is exclusively Indonesian)", () => {
    expect(xml).toContain("<identification><type>KTP</type><number>3174000000000001</number><issue_country>ID</issue_country></identification>");
  });

  it("maps PASSPORT to type PAS with issue_country from nationality (best available stand-in)", () => {
    const passportXml = buildPersonMyClientXml({ ...baseCustomer, identityType: "PASSPORT", nationality: "SG" });
    expect(passportXml).toContain("<type>PAS</type>");
    expect(passportXml).toContain("<issue_country>SG</issue_country>");
  });

  it("omits the identification block entirely for OTHER — goAML has no generic 'other document' code", () => {
    const otherXml = buildPersonMyClientXml({ ...baseCustomer, identityType: "OTHER" });
    expect(otherXml).not.toContain("<identification>");
  });
});

describe("buildGoAmlLtktReportXml", () => {
  const line: GoAmlLtktLine = {
    transactionNumber: "FX-20260901-000001-L1",
    dateTransaction: "2026-09-01T09:00:00.000Z",
    operation: "SELL",
    amountLocalIdr: "600000000.00",
    currencyCode: "USD",
    foreignAmount: "40000.000000",
    agreedRate: "15000.000000",
    customer: baseCustomer,
  };

  const xml = buildGoAmlLtktReportXml({
    rentityId: 1000031,
    reportCode: "LTKTM",
    reportDate: new Date("2026-09-02T00:00:00.000Z"),
    currencyCodeLocal: "IDR",
    reportingUserCode: "sipendar_pelapor",
    lines: [line],
  });

  it("has no <transactions> wrapper — transaction elements are direct siblings of report per the XSD", () => {
    expect(xml).not.toContain("<transactions>");
    expect(xml).toContain("<transaction>");
  });

  it("emits the report envelope fields in xs:sequence order", () => {
    const order = ["<rentity_id>", "<submission_code>", "<report_code>", "<report_date>", "<currency_code_local>", "<reporting_user_code>", "<transaction>"];
    let cursor = -1;
    for (const tag of order) {
      const index = xml.indexOf(tag);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("wraps the single reported party as Multiparty (involved_parties/party), not Biparty t_from/t_to", () => {
    expect(xml).toContain("<involved_parties><party><role>PJS</role>");
    expect(xml).not.toContain("t_from");
    expect(xml).not.toContain("t_to");
  });

  it("includes the foreign_currency block with the line's actual amount and rate", () => {
    expect(xml).toContain("<foreign_currency_code>USD</foreign_currency_code>");
    expect(xml).toContain("<foreign_amount>40000.000000</foreign_amount>");
    expect(xml).toContain("<foreign_exchange_rate>15000.000000</foreign_exchange_rate>");
  });

  it("uses funds_code UT (Uang Tunai) for the cash leg", () => {
    expect(xml).toContain("<funds_code>UT</funds_code>");
  });

  it("starts with a valid XML declaration", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><report>')).toBe(true);
  });
});

describe("buildGoAmlLtkmReportXml", () => {
  const line: GoAmlLtkmLine = {
    transactionNumber: "FX-20260901-000002-L1",
    dateTransaction: "2026-09-01T10:00:00.000Z",
    operation: "BUY",
    amountLocalIdr: "80000000.00",
    currencyCode: "USD",
    foreignAmount: "5000.000000",
    agreedRate: "16000.000000",
    customer: baseCustomer,
  };

  const xml = buildGoAmlLtkmReportXml({
    rentityId: 1000031,
    reportDate: new Date("2026-09-02T00:00:00.000Z"),
    currencyCodeLocal: "IDR",
    reportingUserCode: "sipendar_pelapor",
    reason: "Pola transaksi terpecah menghindari ambang LTKT.",
    lines: [line],
    indicatorCodes: ["POLA-001", "TUNDA-002"],
  });

  it("always uses report_code LTKM (LTKMP/LTKMT are out of scope)", () => {
    expect(xml).toContain("<report_code>LTKM</report_code>");
  });

  it("emits the report envelope fields in xs:sequence order, including reason before the transaction and report_indicators after it", () => {
    const order = ["<rentity_id>", "<submission_code>", "<report_code>", "<report_date>", "<currency_code_local>", "<reporting_user_code>", "<reason>", "<transaction>", "<report_indicators>"];
    let cursor = -1;
    for (const tag of order) {
      const index = xml.indexOf(tag);
      expect(index, `${tag} should be present`).toBeGreaterThan(-1);
      expect(index, `${tag} should come after the previous element`).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("omits <reason> entirely when not supplied, rather than emitting an empty tag", () => {
    const xmlWithoutReason = buildGoAmlLtkmReportXml({
      rentityId: 1000031, reportDate: new Date("2026-09-02T00:00:00.000Z"), currencyCodeLocal: "IDR",
      reportingUserCode: "sipendar_pelapor", lines: [line], indicatorCodes: ["POLA-001"],
    });
    expect(xmlWithoutReason).not.toContain("<reason>");
  });

  it("wraps every selected indicator code in report_indicators/indicator", () => {
    expect(xml).toContain("<report_indicators><indicator>POLA-001</indicator><indicator>TUNDA-002</indicator></report_indicators>");
  });

  it("reuses the same Multiparty transaction shape as LTKT (party/role/person_my_client/funds_code)", () => {
    expect(xml).toContain("<involved_parties><party><role>PJS</role>");
    expect(xml).toContain("<funds_code>UT</funds_code>");
  });

  it("starts with a valid XML declaration", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><report>')).toBe(true);
  });
});
