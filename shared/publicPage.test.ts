import { describe, expect, it } from "vitest";
import { DEFAULT_FRAUD_WARNING, DEFAULT_PUBLIC_FAQ, fraudWarningOrDefault, hasContactSection, isSafeMapUrl, normalizePublicPage, publicFaqOrDefault, telHref } from "./publicPage";

const base = { publicPageEnabled: true, publicFaq: [] };

describe("isian halaman publik", () => {
  it("FAQ kosong, null, atau berisi baris kosong memakai FAQ produk netral", () => {
    expect(publicFaqOrDefault(null)).toBe(DEFAULT_PUBLIC_FAQ);
    expect(publicFaqOrDefault([{ question: " ", answer: "x" }])).toBe(DEFAULT_PUBLIC_FAQ);
    expect(JSON.stringify(DEFAULT_PUBLIC_FAQ)).not.toMatch(/\d{3}|Valasindo|Cianjur/);
  });

  it("FAQ milik perusahaan dipakai apa adanya", () => {
    const own = [{ question: "Buka hari Minggu?", answer: "Tidak." }];
    expect(publicFaqOrDefault(own)).toEqual(own);
  });

  it("peringatan penipuan kosong memakai teks produk netral", () => {
    expect(fraudWarningOrDefault("  ")).toBe(DEFAULT_FRAUD_WARNING);
    expect(fraudWarningOrDefault("Hati-hati.")).toBe("Hati-hati.");
  });

  it("tautan peta hanya https", () => {
    expect(isSafeMapUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isSafeMapUrl("http://maps.example/abc")).toBe(false);
    expect(isSafeMapUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMapUrl("bukan tautan")).toBe(false);
  });

  it("nomor telepon menjadi tautan tel: tanpa spasi dan strip", () => {
    expect(telHref("+62 263-265500")).toBe("tel:+62263265500");
  });

  it("bagian kontak hilang bila seluruh isiannya kosong", () => {
    expect(hasContactSection({ address: " ", phone: null, secondaryPhone: "", openingHours: null, mapUrl: null })).toBe(false);
    expect(hasContactSection({ phone: "+62 21 555" })).toBe(true);
  });

  it("isian kosong disimpan sebagai null dan teks dipangkas", () => {
    const result = normalizePublicPage({ ...base, secondaryPhone: "  ", openingHours: " Senin–Sabtu ", mapUrl: "", fraudWarning: "", publicFaq: [{ question: " Q ", answer: " A " }] });
    expect(result).toEqual({ ok: true, values: { publicPageEnabled: true, secondaryPhone: null, openingHours: "Senin–Sabtu", mapUrl: null, fraudWarning: null, publicFaq: [{ question: "Q", answer: "A" }] } });
  });

  it("menolak peta non-https, lebih dari 12 pertanyaan, dan pertanyaan tanpa jawaban", () => {
    expect(normalizePublicPage({ ...base, mapUrl: "http://maps.example" })).toMatchObject({ ok: false, error: expect.stringContaining("https://") });
    const thirteen = Array.from({ length: 13 }, (_, index) => ({ question: `Q${index}`, answer: "A" }));
    expect(normalizePublicPage({ ...base, publicFaq: thirteen })).toMatchObject({ ok: false, error: expect.stringContaining("12") });
    expect(normalizePublicPage({ ...base, publicFaq: [{ question: "Q", answer: "A" }, { question: "Q2", answer: " " }] })).toMatchObject({ ok: false, error: expect.stringContaining("ke-2") });
  });
});
