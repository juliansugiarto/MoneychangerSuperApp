import { describe, expect, it } from "vitest";
import { customerInput } from "./routers";
import { v1Fixtures } from "./v1Fixtures";

describe("customerInput — goAML-mandatory KYC fields (t_person_my_client)", () => {
  it("requires gender", () => {
    const { gender: _gender, ...withoutGender } = v1Fixtures.customer;
    expect(customerInput.safeParse(withoutGender).success).toBe(false);
  });

  it("requires nationality as a 2-letter ISO code", () => {
    expect(customerInput.safeParse({ ...v1Fixtures.customer, nationality: "IDN" }).success).toBe(false);
    expect(customerInput.safeParse({ ...v1Fixtures.customer, nationality: "" }).success).toBe(false);
    expect(customerInput.safeParse(v1Fixtures.customer).success).toBe(true);
  });

  it("requires addressCountry as a 2-letter ISO code", () => {
    expect(customerInput.safeParse({ ...v1Fixtures.customer, addressCountry: "IDN" }).success).toBe(false);
  });

  it("requires addressType and addressCity", () => {
    const { addressType: _addressType, ...withoutAddressType } = v1Fixtures.customer;
    expect(customerInput.safeParse(withoutAddressType).success).toBe(false);
    const { addressCity: _addressCity, ...withoutAddressCity } = v1Fixtures.customer;
    expect(customerInput.safeParse(withoutAddressCity).success).toBe(false);
  });

  it("uppercases nationality and addressCountry codes", () => {
    const parsed = customerInput.parse({ ...v1Fixtures.customer, nationality: "id", addressCountry: "id" });
    expect(parsed.nationality).toBe("ID");
    expect(parsed.addressCountry).toBe("ID");
  });

  it("leaves npwp, addressProvince, addressDistrict, addressPostalCode optional", () => {
    const { addressProvince: _p, addressDistrict: _d, addressPostalCode: _z, ...withoutOptional } = v1Fixtures.customer as Record<string, unknown>;
    expect(customerInput.safeParse(withoutOptional).success).toBe(true);
  });
});
