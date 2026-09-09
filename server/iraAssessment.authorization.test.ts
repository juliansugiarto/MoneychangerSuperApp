import { describe, expect, it } from "vitest";
import { iraApprovalDenial, iraEditDenial } from "./iraAssessment";

/**
 * Gerbang peran penilaian IRA sebagai fungsi tersendiri, meniru `financialFormExportDenial` dan
 * `iraClassificationDenial`. Otorisasi yang hanya hidup di dalam handler tidak pernah dibuktikan
 * uji mana pun, dan gerbang yang tidak diuji adalah gerbang yang diam-diam hilang pada
 * penyuntingan berikutnya.
 */

const user = (role: string, mustChangePassword = false) => ({ role, mustChangePassword });

describe("gerbang penyuntingan penilaian", () => {
  it("ADMIN boleh mengisi dan mengajukan, STAFF tidak", () => {
    expect(iraEditDenial(user("ADMIN"), "DRAFT")).toBeNull();
    expect(iraEditDenial(user("CONTROLLER"), "DRAFT")).toBeNull();
    expect(iraEditDenial(user("SHAREHOLDER"), "DRAFT")).toBeNull();
    expect(iraEditDenial(user("STAFF"), "DRAFT")?.status).toBe(403);
  });

  it("penilaian DISETUJUI menolak seluruh penyuntingan, termasuk oleh SHAREHOLDER", () => {
    for (const role of ["ADMIN", "CONTROLLER", "SHAREHOLDER"]) {
      const denial = iraEditDenial(user(role), "DISETUJUI");
      expect([role, denial?.status]).toEqual([role, 403]);
      expect(denial?.message).toMatch(/disetujui|terkunci/i);
    }
  });

  it("penilaian yang sedang menunggu persetujuan masih boleh diperbaiki pengisinya", () => {
    expect(iraEditDenial(user("ADMIN"), "MENUNGGU_PERSETUJUAN")).toBeNull();
  });

  it("menolak siapa pun yang masih wajib mengganti kata sandi", () => {
    expect(iraEditDenial(user("ADMIN", true), "DRAFT")?.status).toBe(403);
    expect(iraApprovalDenial(user("SHAREHOLDER", true))?.status).toBe(403);
  });
});

describe("gerbang persetujuan penilaian", () => {
  it("SHAREHOLDER boleh menyetujui; CONTROLLER tidak", () => {
    expect(iraApprovalDenial(user("SHAREHOLDER"))).toBeNull();
    expect(iraApprovalDenial(user("CONTROLLER"))?.status).toBe(403);
    expect(iraApprovalDenial(user("ADMIN"))?.status).toBe(403);
    expect(iraApprovalDenial(user("STAFF"))?.status).toBe(403);
  });

  it("ADMIN yang mengisi tidak boleh sekaligus menyetujui — itu inti pemisahannya", () => {
    expect(iraEditDenial(user("ADMIN"), "DRAFT")).toBeNull();
    expect(iraApprovalDenial(user("ADMIN"))?.message).toMatch(/pemegang saham|shareholder/i);
  });
});
