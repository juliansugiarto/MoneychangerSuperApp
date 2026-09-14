import { describe, expect, it } from "vitest";
import { backOfficeDestinations } from "./backOfficeNavigation";
import { paletteEntries } from "./commandPalette";

describe("paletteEntries", () => {
  it("CONTROLLER melihat seluruh tujuan sidebar, masing-masing dengan kelompoknya", () => {
    const entries = paletteEntries("CONTROLLER");
    expect(entries.map((entry) => entry.path)).toEqual(backOfficeDestinations.map((item) => item.path));
    expect(entries.find((entry) => entry.path === "/operasional/stock/kas-awal")).toEqual({
      path: "/operasional/stock/kas-awal", label: "Kas Awal Hari Ini", group: "Uang & Kurs",
    });
  });

  it("STAFF tidak ditawari halaman di atas kewenangannya", () => {
    const paths = paletteEntries("STAFF").map((entry) => entry.path);
    expect(paths).toContain("/operasional/transaksi");
    expect(paths).not.toContain("/operasional/kurs");
    expect(paths).not.toContain("/operasional/buku-besar");
    expect(paths).not.toContain("/kepatuhan/ira");
  });

  it("ADMIN mendapat IRA dan kurs, tetapi tidak laporan keuangan", () => {
    const paths = paletteEntries("ADMIN").map((entry) => entry.path);
    expect(paths).toContain("/kepatuhan/ira");
    expect(paths).toContain("/operasional/kurs");
    expect(paths).not.toContain("/operasional/laporan-keuangan");
  });
});
