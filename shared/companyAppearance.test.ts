import { describe, expect, it } from "vitest";
import { checkAppearance } from "./companyAppearance";

describe("tampilan perusahaan", () => {
  it("palet di luar keenam palet ditolak", () => {
    expect(checkAppearance({ themePalette: "NEON", accentColor: null })).toMatchObject({ ok: false, error: expect.stringContaining("tidak dikenal") });
  });

  it("warna sendiri yang kosong berarti warna utama palet", () => {
    expect(checkAppearance({ themePalette: "ZAMRUD", accentColor: "  " })).toEqual({ ok: true, values: { themePalette: "ZAMRUD", accentColor: null } });
  });

  it("teks yang bukan kode warna ditolak dengan contoh", () => {
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "merah" })).toMatchObject({ ok: false, error: expect.stringContaining("bukan kode warna") });
  });

  it("warna kurang kontras ditolak dengan rasio terbaiknya; yang lolos disimpan huruf besar", () => {
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "#777777" })).toMatchObject({ ok: false, error: expect.stringContaining("4,48:1") });
    expect(checkAppearance({ themePalette: "MARUN", accentColor: "#0f5a41" })).toEqual({ ok: true, values: { themePalette: "MARUN", accentColor: "#0F5A41" } });
  });
});
