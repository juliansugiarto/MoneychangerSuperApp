import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aplikasi ini dijual ke banyak money changer. Identitas satu perusahaan — nama, alamat, telepon
 * PT Ibukota Valasindo — pernah tertulis mati di nota, arsip penutupan, dan cetakan pelaporan, sehingga
 * instalasi perusahaan lain mencetak identitas IBV. Identitas hanya boleh datang dari Profil Perusahaan.
 */
const FORBIDDEN = /Ibukota|IBU KOTA|Mangun Sarkoro|265500|265600/i;
const ROOTS = ["client/src", "server", "shared"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("tidak ada identitas perusahaan yang ditulis mati", () => {
  it("kode aplikasi tidak memuat nama, alamat, atau telepon PT Ibukota Valasindo", () => {
    const offenders = ROOTS.flatMap(sourceFiles).filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
