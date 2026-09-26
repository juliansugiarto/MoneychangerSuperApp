import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT } from "../shared/secretCodes";
import { paddedCodeCandidates } from "./recoveryCodes";

const DUMMY = "scrypt$v1$tiruan$tiruan";
const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1, codeHash: `hash-${index + 1}` }));

describe("kandidat kode pemulihan yang diperiksa", () => {
  it("username yang bukan pemilik tetap memeriksa delapan hash tiruan, sehingga lamanya jawaban tidak membedakan akun", () => {
    const candidates = paddedCodeCandidates([], DUMMY);
    expect(candidates).toHaveLength(RECOVERY_CODE_COUNT);
    expect(candidates.every((candidate) => candidate.id === null && candidate.codeHash === DUMMY)).toBe(true);
  });

  it("pemilik dengan sisa tiga kode memeriksa ketiganya lalu lima hash tiruan", () => {
    const candidates = paddedCodeCandidates(rows(3), DUMMY);
    expect(candidates).toHaveLength(RECOVERY_CODE_COUNT);
    expect(candidates.slice(0, 3).map((candidate) => candidate.id)).toEqual([1, 2, 3]);
    expect(candidates.slice(3).every((candidate) => candidate.id === null)).toBe(true);
  });

  it("tidak pernah memotong kode sungguhan, walau jumlahnya melebihi delapan", () => {
    expect(paddedCodeCandidates(rows(9), DUMMY).map((candidate) => candidate.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
