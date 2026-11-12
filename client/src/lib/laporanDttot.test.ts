import { describe, expect, it } from "vitest";
import { buildLaporanNihilHtml, buildLaporanPemblokiranHtml, clockWib, longDayDate } from "./laporanDttot";

const company = { legalName: "PT Contoh Valuta", address: "Jl. Contoh 1, Jakarta" };
const signer = { name: "Direktur Uji", position: "Direktur" };
// 15 Oktober 2026 04.38 UTC = 11.38 WIB, hari Kamis.
const at = new Date("2026-10-15T04:38:00Z");

describe("laporan DTTOT ke Densus 88", () => {
  it("tanggal dan jam selalu WIB, apa pun zona perangkat", () => {
    expect(longDayDate(at)).toBe("Kamis, 15 Oktober 2026");
    expect(clockWib(at)).toBe("11.38 WIB");
  });

  it("Laporan Nihil memuat dasar hukum, batas waktu penyaringan, dan kata NIHIL", () => {
    const html = buildLaporanNihilHtml({ company, reportNumber: "001/DTTOT/X/2026", place: "Jakarta", reportDate: at, screenedAt: at, signer });
    expect(html).toContain("Laporan Nihil atas Pemblokiran Secara Serta Merta");
    expect(html).toContain("Pasal 28 ayat (3) Undang-Undang Nomor 9 Tahun 2013");
    expect(html).toContain("sampai dengan Kamis, 15 Oktober 2026, pukul\n  11.38 WIB");
    expect(html).toContain("atau NIHIL");
    expect(html).toContain("c.q. Kepala Densus 88");
  });

  it("Laporan Pemblokiran: satu surat pengantar + satu berita acara per nasabah, teks nasabah di-escape", () => {
    const html = buildLaporanPemblokiranHtml({
      company, reportNumber: "002/DTTOT/XI/2026", place: "Jakarta", reportDate: at, blockedAt: at, signer,
      witness: { name: "Saksi Uji", position: "Petugas APU PPT" }, biLetter: "surel 15 Oktober 2026", listNumber: "DTTOT/P-25/X/RES.6.1./2026",
      matched: [{ fullName: "Budi <b>Santoso</b>", placeOfBirth: "Bandung", dateOfBirth: "1980-01-02", occupation: "Wiraswasta", address: "Jl. A" }, { fullName: "Nasabah Dua" }],
    });
    expect(html.match(/BERITA ACARA PEMBLOKIRAN SECARA SERTA MERTA/g)).toHaveLength(2);
    expect(html).toContain("Budi &lt;b&gt;Santoso&lt;/b&gt;");
    expect(html).not.toContain("<b>Santoso</b>");
    expect(html).toContain("atas DTTOT Nomor DTTOT/P-25/X/RES.6.1./2026");
  });
});
