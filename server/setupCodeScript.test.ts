import { describe, expect, it } from "vitest";
import { SECRET_CODE_ALPHABET, SETUP_CODE_GROUPS, normalizeSecretCode } from "../shared/secretCodes";
import { verifyPassword } from "./internalAuth";
import { SETUP_CODE_ALPHABET, generateSetupCode, hashSetupCode } from "../scripts/setupCode.mjs";

describe("kode penyiapan dari skrip .mjs", () => {
  it("memakai alfabet dan bentuk yang sama dengan shared/secretCodes.ts", () => {
    expect(SETUP_CODE_ALPHABET).toBe(SECRET_CODE_ALPHABET);
    expect(normalizeSecretCode(generateSetupCode(), SETUP_CODE_GROUPS)).not.toBeNull();
  });

  it("hash-nya diverifikasi server atas bentuk rapat, termasuk ketikan huruf kecil berspasi", async () => {
    const code = generateSetupCode();
    const hash = await hashSetupCode(code);
    expect(hash).not.toContain(code.replace(/-/g, ""));
    expect(await verifyPassword(normalizeSecretCode(code, SETUP_CODE_GROUPS)!, hash)).toBe(true);
    expect(await verifyPassword(normalizeSecretCode(code.toLowerCase().replace(/-/g, " "), SETUP_CODE_GROUPS)!, hash)).toBe(true);
  });
});
