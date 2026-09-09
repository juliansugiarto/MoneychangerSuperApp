import { describe, expect, it, vi, beforeEach } from "vitest";
import * as db from "./db";
import {
  customerHighRiskDenial,
  decideHighRisk,
  highRiskDecisionDenial,
  highRiskResetValues,
} from "./customerHighRiskApproval";

/**
 * Gerbang persetujuan nasabah berisiko tinggi — pemblokiran operasional pertama di aplikasi ini.
 *
 * Yang diuji di sini bukan tampilannya, melainkan keputusan siapa yang menahan bon: fungsi murni
 * penolakannya, dan penulis keputusannya beserta gerbang perannya.
 */

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    limit: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function tableName(table: unknown) {
  return String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
}

const nasabahBerisiko = {
  id: 21, cifNumber: "CIF-0021", fullName: "Nasabah Berisiko", isDemo: false, isHistorical: false,
  riskLevel: "HIGH" as const, profileStatus: "RESTRICTED" as const,
  highRiskDecision: "BELUM" as const, highRiskDecidedByUserId: null, highRiskDecidedAt: null, highRiskDecisionNotes: null,
};

function mockDb(customer: Record<string, unknown> = nasabahBerisiko) {
  const inserted: { table: string; values: Record<string, unknown> }[] = [];
  const updated: Record<string, unknown>[] = [];
  const fakeDb = {
    select: vi.fn(() => ({ from: (table: unknown) => makeReader(tableName(table) === "customers" ? [customer] : []) })),
    insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => { inserted.push({ table: tableName(table), values }); return Promise.resolve(); } })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updated.push(values); return { where: () => Promise.resolve() }; } })),
  };
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updated };
}

const pemegangSaham = { id: 4, role: "SHAREHOLDER" as const };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("customerHighRiskDenial", () => {
  it("nasabah LOW/MEDIUM tidak pernah tertolak apa pun keputusannya", () => {
    for (const riskLevel of ["LOW", "MEDIUM"] as const) {
      for (const highRiskDecision of ["BELUM", "DISETUJUI", "DITOLAK"] as const) {
        expect(customerHighRiskDenial({ riskLevel, highRiskDecision })).toBeNull();
      }
    }
  });

  it("nasabah HIGH berkeputusan BELUM tertolak, pesannya menyebut SHAREHOLDER", () => {
    const denial = customerHighRiskDenial({ riskLevel: "HIGH", highRiskDecision: "BELUM" });
    expect(denial).not.toBeNull();
    expect(denial).toContain("SHAREHOLDER");
    expect(denial).toContain("Pemegang Saham");
  });

  it("nasabah HIGH berkeputusan DITOLAK tertolak", () => {
    const denial = customerHighRiskDenial({ riskLevel: "HIGH", highRiskDecision: "DITOLAK" });
    expect(denial).not.toBeNull();
    // Ditolak bukan "belum diputuskan": pesannya tidak boleh menyuruh menunggu keputusan yang sudah ada.
    expect(denial).toContain("ditolak");
  });

  it("nasabah HIGH berkeputusan DISETUJUI lolos", () => {
    expect(customerHighRiskDenial({ riskLevel: "HIGH", highRiskDecision: "DISETUJUI" })).toBeNull();
  });

  it("menyebut pihak mana yang tertahan bila yang diperiksa pihak kuasa/wakil", () => {
    const denial = customerHighRiskDenial({ riskLevel: "HIGH", highRiskDecision: "BELUM" }, "Nasabah pihak kuasa/wakil");
    expect(denial).toContain("Nasabah pihak kuasa/wakil");
  });
});

describe("highRiskDecisionDenial", () => {
  it("hanya SHAREHOLDER yang boleh memutuskan", () => {
    for (const role of ["STAFF", "ADMIN", "CONTROLLER"]) {
      expect(highRiskDecisionDenial({ role, mustChangePassword: false })).not.toBeNull();
    }
    expect(highRiskDecisionDenial({ role: "SHAREHOLDER", mustChangePassword: false })).toBeNull();
  });

  it("kata sandi yang wajib diganti menahan siapa pun", () => {
    expect(highRiskDecisionDenial({ role: "SHAREHOLDER", mustChangePassword: true })?.status).toBe(403);
  });
});

describe("decideHighRisk", () => {
  it("hanya SHAREHOLDER yang boleh memutuskan", async () => {
    mockDb();
    await expect(decideHighRisk({ customerId: 21, decision: "DISETUJUI", notes: "Sudah diperiksa berkasnya." }, { id: 2, role: "CONTROLLER" }))
      .rejects.toThrow(/Pemegang Saham/);
  });

  it("menolak keputusan tanpa alasan tertulis", async () => {
    mockDb();
    await expect(decideHighRisk({ customerId: 21, decision: "DISETUJUI", notes: "  " }, pemegangSaham))
      .rejects.toThrow(/[Aa]lasan/);
  });

  it("menolak keputusan atas nasabah yang bukan berisiko tinggi", async () => {
    mockDb({ ...nasabahBerisiko, riskLevel: "LOW" });
    await expect(decideHighRisk({ customerId: 21, decision: "DISETUJUI", notes: "Tidak ada alasannya." }, pemegangSaham))
      .rejects.toThrow(/berisiko tinggi/);
  });

  it("menulis audit_logs beserta keputusan sebelum dan sesudahnya", async () => {
    const { inserted, updated } = mockDb();

    await decideHighRisk({ customerId: 21, decision: "DISETUJUI", notes: "Sumber dana terverifikasi." }, pemegangSaham);

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ highRiskDecision: "DISETUJUI", highRiskDecidedByUserId: 4, highRiskDecisionNotes: "Sumber dana terverifikasi." });
    expect(updated[0].highRiskDecidedAt).toBeInstanceOf(Date);

    const audit = inserted.find((row) => row.table === "audit_logs")!;
    expect(audit.values).toMatchObject({ action: "CUSTOMER_HIGH_RISK_DECIDED", entityType: "customer", entityId: "21", actorUserId: 4 });
    expect(audit.values.beforeState).toMatchObject({ highRiskDecision: "BELUM" });
    expect(audit.values.afterState).toMatchObject({ highRiskDecision: "DISETUJUI" });
    expect(audit.values.reason).toBe("Sumber dana terverifikasi.");
  });

  it("penolakan tercatat sama lengkapnya dengan persetujuan", async () => {
    const { inserted, updated } = mockDb({ ...nasabahBerisiko, highRiskDecision: "DISETUJUI", highRiskDecidedByUserId: 4 });

    await decideHighRisk({ customerId: 21, decision: "DITOLAK", notes: "Hubungan usaha dihentikan." }, pemegangSaham);

    expect(updated[0]).toMatchObject({ highRiskDecision: "DITOLAK" });
    const audit = inserted.find((row) => row.table === "audit_logs")!;
    expect(audit.values.beforeState).toMatchObject({ highRiskDecision: "DISETUJUI" });
    expect(audit.values.afterState).toMatchObject({ highRiskDecision: "DITOLAK" });
  });
});

describe("highRiskResetValues", () => {
  it("perpindahan MENJADI HIGH menyetel ulang keputusan beserta tiga kolom penyertanya", () => {
    expect(highRiskResetValues("LOW", "HIGH")).toEqual({
      highRiskDecision: "BELUM", highRiskDecidedByUserId: null, highRiskDecidedAt: null, highRiskDecisionNotes: null,
    });
    expect(highRiskResetValues("MEDIUM", "HIGH")).not.toBeNull();
  });

  it("HIGH → HIGH TIDAK menyetel ulang", () => {
    // Menyetel ulang di sini berarti setiap penyuntingan nasabah berisiko tinggi mencabut
    // persetujuan yang sah dan menghentikan operasional tanpa alasan.
    expect(highRiskResetValues("HIGH", "HIGH")).toBeNull();
  });

  it("turun dari HIGH tidak menyetel ulang apa pun", () => {
    expect(highRiskResetValues("HIGH", "LOW")).toBeNull();
    expect(highRiskResetValues("MEDIUM", "LOW")).toBeNull();
  });
});
