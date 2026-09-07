import { describe, expect, it } from "vitest";
import { FINANCIAL_NOTES, GENERATED_NOTE_KEYS, NARRATIVE_NOTE_KEYS, findFinancialNote, notePeriodKey } from "./financialNotes";

describe("daftar catatan CALK", () => {
  it("memuat delapan catatan bangkitan dan tujuh naratif", () => {
    expect(GENERATED_NOTE_KEYS).toHaveLength(8);
    expect(NARRATIVE_NOTE_KEYS).toHaveLength(7);
  });

  it("tidak punya kunci ganda", () => {
    expect(new Set(FINANCIAL_NOTES.map((note) => note.key)).size).toBe(FINANCIAL_NOTES.length);
  });

  it("memberi panduan pada setiap catatan, dan tidak satu pun teks contoh", () => {
    // Kebijakan akuntansi adalah pernyataan yang ditandatangani manajemen. Mengisikan contohnya
    // berarti mengarang pernyataan itu atas namanya — dan pemeriksa membaca CALK justru untuk
    // mengetahui apa yang benar-benar diputuskan manajemen.
    for (const note of FINANCIAL_NOTES) {
      expect(note.guidance.length).toBeGreaterThan(40);
      expect(note).not.toHaveProperty("bodyText");
      expect(note).not.toHaveProperty("defaultText");
    }
  });

  it("menjaga kunci yang tersimpan di basis data tetap muat pada kolomnya", () => {
    // `financial_statement_notes.noteKey` berukuran varchar(60).
    for (const note of FINANCIAL_NOTES) expect(note.key.length).toBeLessThanOrEqual(60);
  });

  it("menemukan catatan lewat kuncinya, dan mengembalikan null untuk kunci asing", () => {
    expect(findFinancialNote("KEBIJAKAN_AKUNTANSI")?.kind).toBe("NARATIF");
    expect(findFinancialNote("KAS_DAN_SETARA_KAS")?.kind).toBe("BANGKITAN");
    expect(findFinancialNote("TIDAK_ADA")).toBeNull();
  });

  it("menurunkan kunci periode dari bulan akhir laporannya", () => {
    expect(notePeriodKey("2026-09-30")).toBe("2026-09");
  });
});
