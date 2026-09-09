import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Menjaga satu ejaan untuk daftar sanksi proliferasi. Sapuan sekali jalan akan terurai kembali;
 * penjaga inilah yang menahannya, meniru `server/notaKupvaIdentity.test.ts` yang sudah menegakkan
 * temuan pemeriksaan 4 dengan cara yang sama.
 *
 * TIGA ejaan berikut BENAR dan sengaja tidak dijaga di sini:
 *   PPSPM  — tindak pidananya. Kode parameter IRA `PPSPM_1A`…`PPSPM_4A` dan `iraRiskTypes`
 *            adalah KUNCI BASIS DATA pada `ira_inherent_values`; menggantinya merusak data.
 *   PPPSPM — program pencegahannya (APU PPT PPPSPM).
 *   DPPSPM — daftarnya, yang disimpan `sanctions_watchlist_entries`.
 *
 * Yang dijaga adalah `PPPSM`, yang tidak mengeja apa pun, dan `"DTTOT/PPSPM"` yang memasangkan
 * daftar dengan nama tindak pidana.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));

const ALLOWED_PPPSM = [
  // Kutipan APA ADANYA dari templat BI (pertanyaan KPMR_P4_3). Templatnya sendiri salah eja di
  // tengah kalimat yang empat kali menulis PPPSPM dengan benar. Menggantinya = memalsukan kutipan.
  "shared/iraKpmrCatalogue.ts",
  // Berkas ini sendiri — ia HARUS menyebut ejaan yang dilarangnya untuk dapat melarangnya.
  "server/sanctionsListNaming.test.ts",
];

/** Seluruh .ts/.tsx di bawah `dir`, rekursif, relatif terhadap akar repo. */
function sourceFiles(dir: string): string[] {
  return readdirSync(`${ROOT}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : sourceFiles(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

const scanned = [...sourceFiles("server"), ...sourceFiles("shared"), ...sourceFiles("client/src"), "drizzle/schema.ts"];

function containing(needle: string, allowed: string[] = []): string[] {
  return scanned
    .filter((file) => !allowed.some((entry) => file === entry))
    .filter((file) => readFileSync(`${ROOT}${file}`, "utf8").includes(needle));
}

describe("ejaan daftar sanksi proliferasi", () => {
  it("memindai berkas sumber dalam jumlah yang masuk akal", () => {
    // Tanpa ini, `sourceFiles` yang salah jalur mengembalikan larik kosong dan SELURUH uji di bawah
    // lulus tanpa memeriksa apa pun.
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned).toContain("drizzle/schema.ts");
    expect(scanned).toContain("shared/iraKpmrCatalogue.ts");
  });

  it("tidak ada lagi PPPSM di sumber, kecuali kutipan templat BI", () => {
    expect(containing("PPPSM", ALLOWED_PPPSM)).toEqual([]);
  });

  it("kutipan KPMR_P4_3 masih utuh — penjaganya tidak boleh memancing orang memalsukan kutipan", () => {
    expect(readFileSync(`${ROOT}shared/iraKpmrCatalogue.ts`, "utf8")).toContain("tipologi TPPU, TPPT, dan PPPSM");
  });

  it("tidak ada lagi pesan DTTOT/PPSPM — pasangan daftarnya adalah DTTOT/DPPSPM", () => {
    expect(containing("DTTOT/PPSPM", ["server/sanctionsListNaming.test.ts"])).toEqual([]);
  });

  it("riwayat migrasi tidak ikut disunting", () => {
    // 0033 MEMBUAT tabel ini dengan enum('DTTOT','PPPSM'), dan hash berkasnya tersimpan di
    // __drizzle_migrations — termasuk di produksi, yang justru berhenti tepat pada migrasi itu.
    // Menyuntingnya membuat jurnalnya tidak konsisten selamanya.
    expect(readFileSync(`${ROOT}drizzle/0033_pretty_killraven.sql`, "utf8")).toContain("enum('DTTOT','PPPSM')");
    // 0056 adalah yang menggantinya, dan ia menyebut kedua nilai justru karena melebarkan dahulu.
    expect(readFileSync(`${ROOT}drizzle/0056_young_zzzax.sql`, "utf8")).toContain("enum('DTTOT','PPPSM','DPPSPM')");
  });

  it("kode parameter IRA tidak ikut tersapu", () => {
    // Pagar bagi sapuan cari-ganti naif: PPSPM adalah substring dari PPPSPM dan DPPSPM.
    const parameters = readFileSync(`${ROOT}shared/iraParameters.ts`, "utf8");
    expect(parameters).toContain('"PPSPM_1A"');
    expect(parameters).toContain('"PPSPM_4A"');
    expect(readFileSync(`${ROOT}drizzle/schema.ts`, "utf8")).toContain('export const iraRiskTypes = ["TPPU", "TPPT", "PPSPM"] as const;');
  });
});
