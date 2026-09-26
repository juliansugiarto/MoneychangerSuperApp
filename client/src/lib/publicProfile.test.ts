import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/components/shell/brand";
import { authBrand } from "./publicProfile";

describe("nama usaha di layar tanpa akun", () => {
  it("belum diketahui selama profil publik masih dimuat", () => {
    expect(authBrand({ data: undefined, isError: false })).toBeNull();
  });

  it("nama dagang begitu profil termuat", () => {
    expect(authBrand({ data: { tradingName: "ABC Valas" }, isError: false })).toBe("ABC Valas");
  });

  it("nama produk bila profil gagal dimuat atau nama dagang kosong", () => {
    expect(authBrand({ data: undefined, isError: true })).toBe(PRODUCT_NAME);
    expect(authBrand({ data: { tradingName: null }, isError: false })).toBe(PRODUCT_NAME);
  });
});
