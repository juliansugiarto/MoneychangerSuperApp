import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT, SECRET_CODE_ALPHABET, SETUP_CODE_GROUPS, formatSecretCode, generateRecoveryCodes, generateSecretCode, normalizeSecretCode } from "./secretCodes";

describe("kode rahasia", () => {
  it("alfabetnya 32 huruf unik tanpa 0, O, 1, dan I", () => {
    expect(new Set(SECRET_CODE_ALPHABET).size).toBe(32);
    for (const confusing of ["0", "O", "1", "I"]) expect(SECRET_CODE_ALPHABET).not.toContain(confusing);
  });

  it("dibentuk kelompok empat huruf", () => {
    expect(generateSecretCode(2)).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(generateSecretCode(SETUP_CODE_GROUPS)).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("memetakan byte acak dengan lima bit terbawah, sehingga sebarannya seragam", () => {
    expect(generateSecretCode(1, () => Uint8Array.from([0, 31, 32, 63]))).toBe("A9A9");
  });

  it("delapan kode pemulihan, semuanya berbeda", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("menerima ketikan manusia: huruf kecil, spasi, dan strip di mana saja", () => {
    expect(normalizeSecretCode("abcd efgh", 2)).toBe("ABCDEFGH");
    expect(normalizeSecretCode("ab-cd-ef-gh", 2)).toBe("ABCDEFGH");
    expect(normalizeSecretCode(" abcd-efgh-jklm ", 3)).toBe("ABCDEFGHJKLM");
  });

  it("menolak panjang yang salah dan huruf di luar alfabet, lalu memformat ulang bentuk rapat", () => {
    expect(normalizeSecretCode("ABCDEFG", 2)).toBeNull();
    expect(normalizeSecretCode("ABCD0FGH", 2)).toBeNull();
    expect(formatSecretCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});
