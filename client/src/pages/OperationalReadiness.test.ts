import { describe, expect, it } from "vitest";
import { unavailableDetail } from "./OperationalReadiness";

describe("kartu kesiapan yang tidak tersedia", () => {
  it("hanya FORBIDDEN yang disebut soal peran; galat lain = gagal memuat", () => {
    expect(unavailableDetail({ data: { code: "FORBIDDEN" } }, "Status pemblokiran")).toBe("Status pemblokiran hanya terlihat oleh Controller ke atas.");
    expect(unavailableDetail({ data: { code: "INTERNAL_SERVER_ERROR" } }, "Status pemblokiran")).toBe("Status pemblokiran belum bisa dimuat. Muat ulang halaman.");
    expect(unavailableDetail(null, "Status tinjauan")).toBe("Status tinjauan belum bisa dimuat. Muat ulang halaman.");
  });
});
