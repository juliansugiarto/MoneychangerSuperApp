import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Temuan pemeriksaan: perekrutan berasal dari lingkungan keluarga tanpa penyaringan yang
 * terdokumentasi. Yang perlu dijaga bukan bentuk formulirnya, melainkan aturan-aturan yang
 * membuat catatannya bernilai sebagai bukti — dan aturan itulah yang diuji di sini.
 */
const source = readFileSync(new URL("./sdmOperations.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Kepegawaian.tsx", import.meta.url), "utf8");

describe("penyimpanan calon pegawai", () => {
  it("menyimpan calon pada tabelnya sendiri, bukan sebagai kolom pada pegawai", () => {
    // Kolom penyaringan pada tabel pegawai hanya menyimpan hasil bagi yang diterima; calon yang
    // ditolak tidak akan pernah punya baris di sana, padahal justru merekalah buktinya.
    expect(schemaSource).toContain('mysqlTable("employee_candidates"');
  });

  it("tidak pernah menghapus baris calon", () => {
    const candidateSection = source.slice(source.indexOf("Penyaringan calon pegawai"));
    expect(candidateSection).not.toContain("db.delete(employeeCandidates)");
  });

  it("menghitung calon yang belum disaring dan yang tidak diterima", () => {
    expect(source).toContain('row.screeningResult === "DALAM_PROSES"');
    expect(source).toContain('row.decision === "TIDAK_DITERIMA"');
  });
});

describe("aturan penyaringan", () => {
  it("menolak hasil penyaringan tanpa keterangan", () => {
    expect(source).toContain("Jelaskan sumber pemeriksaan dan dasar hasil penyaringan calon ini.");
  });

  it("menolak menerima calon yang belum lulus penyaringan", () => {
    // Menerima lebih dulu lalu menyaring di atas kertas persis mengulang temuannya.
    expect(source).toContain("Calon hanya dapat diterima setelah hasil penyaringannya LULUS.");
    expect(source).toContain('input.decision === "DITERIMA" && candidate.screeningResult !== "LULUS"');
  });

  it("mengulang pencocokan daftar sanksi saat penyaringan disimpan", () => {
    const screenSection = source.slice(source.indexOf("export async function screenCandidate"));
    expect(screenSection).toContain("matchCandidateAgainstWatchlist(candidate.fullName)");
  });

  it("tidak membiarkan kegagalan pencocokan membatalkan pencatatan calon", () => {
    const matcher = source.slice(source.indexOf("async function matchCandidateAgainstWatchlist"));
    expect(matcher).toContain("} catch {");
    expect(matcher).toContain("watchlistCheckedAt: null");
  });

  it("melewati pencocokan untuk nama yang terlalu pendek, bukan melemparkan galat", () => {
    // searchSanctionsWatchlist menolak kueri di bawah tiga karakter.
    const matcher = source.slice(source.indexOf("async function matchCandidateAgainstWatchlist"));
    expect(matcher).toContain("query.length < 3");
  });
});

describe("jejak audit dan otorisasi", () => {
  it("mencatat pencatatan, penyaringan, dan keputusan pada jejak audit", () => {
    expect(source).toContain('action: "EMPLOYEE_CANDIDATE_RECORDED"');
    expect(source).toContain('action: "EMPLOYEE_CANDIDATE_SCREENED"');
    expect(source).toContain('action: "EMPLOYEE_CANDIDATE_DECIDED"');
  });

  it("tidak menulis nama calon ke jejak audit", () => {
    const recordSection = source.slice(source.indexOf("export async function recordCandidate"), source.indexOf("export async function screenCandidate"));
    const auditPayload = recordSection.slice(recordSection.indexOf("afterState:"));
    expect(auditPayload).not.toContain("fullName");
  });

  it("membaca dengan staffProcedure dan menulis dengan controllerProcedure", () => {
    expect(routerSource).toContain("candidates: staffProcedure.query(() => listCandidates())");
    for (const route of ["recordCandidate", "screenCandidate", "decideCandidate"]) {
      expect(routerSource).toContain(`${route}: controllerProcedure.input(`);
    }
  });
});

describe("tampilan calon pegawai", () => {
  it("menampilkan calon yang tidak diterima, bukan menyembunyikannya", () => {
    expect(pageSource).toContain("Tidak diterima: {candidates.data.rejected}");
  });

  it("membedakan belum dicocokkan dari hasil nihil", () => {
    // "Nihil" pada calon yang belum pernah dicocokkan akan terbaca sebagai penyaringan bersih.
    expect(pageSource).toContain("Belum dicocokkan");
    expect(pageSource).toContain("Nihil");
  });
});
