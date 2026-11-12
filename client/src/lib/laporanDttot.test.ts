import { describe, expect, it } from "vitest";
import { buildLaporanNihilHtml, buildLaporanPembukaanHtml, buildLaporanPemblokiranHtml, buildLaporanPenghapusanNihilHtml, clockWib, longDayDate, placeFromAddress } from "./laporanDttot";

const company = { legalName: "PT Contoh Valuta", address: "Jl. Contoh 1, Jakarta" };
const signer = { name: "Direktur Uji", position: "Direktur" };
// 15 Oktober 2026 04.38 UTC = 11.38 WIB, hari Kamis.
const at = new Date("2026-10-15T04:38:00Z");
const police = { number: "R/7/III/RES.6.1./2026/Densus", date: new Date("2026-03-27T12:00:00Z"), kind: "PERPANJANGAN" as const };

describe("laporan DTTOT ke Densus 88", () => {
  it("tanggal dan jam selalu WIB, apa pun zona perangkat", () => {
    expect(longDayDate(at)).toBe("Kamis, 15 Oktober 2026");
    expect(clockWib(at)).toBe("11.38 WIB");
  });

  it("Laporan Nihil mengikuti surat yang pernah diterima Densus: rujukan surat, alamat Trunojoyo, NIHIL, tembusan BI", () => {
    const html = buildLaporanNihilHtml({ company, reportNumber: "001/DTTOT/X/2026", place: "Cianjur", reportDate: at, screenedAt: at, signer, police });
    expect(html).toContain("Laporan Nihil atas Pemblokiran/Penolakan Transaksi Secara Serta Merta");
    expect(html).toContain("Merujuk Surat Kepala Kepolisian Negara Republik Indonesia No. R/7/III/RES.6.1./2026/Densus tanggal 27 Maret 2026 perihal Bantuan untuk Melakukan Pemblokiran");
    expect(html).toContain("sampai dengan Kamis, 15 Oktober 2026 pukul 11.38 WIB");
    expect(html).toContain("di penyelenggara atau NIHIL");
    expect(html).toContain("Jalan Trunojoyo No. 3, Kebayoran Baru");
    expect(html).toContain("Kepala Kantor Perwakilan Bank Indonesia yang mewilayahi");
    expect(html).toContain("Cianjur, 15 Oktober 2026");
  });

  it("tanpa tanggal surat Densus, kalimat rujukan tetap utuh", () => {
    const html = buildLaporanNihilHtml({ company, reportNumber: "1", place: "Cianjur", reportDate: at, screenedAt: at, signer, police: { ...police, date: null } });
    expect(html).toContain("No. R/7/III/RES.6.1./2026/Densus perihal");
  });

  it("laporan penghapusan nihil merujuk perihal penghapusan", () => {
    const html = buildLaporanPenghapusanNihilHtml({ company, reportNumber: "1", place: "Cianjur", reportDate: at, screenedAt: at, signer, police: { ...police, kind: "PENGHAPUSAN" } });
    expect(html).toContain("perihal Penghapusan Identitas Orang dan Entitas dari Daftar Terduga Teroris dan Organisasi Teroris");
    expect(html).toContain("tidak ada pemblokiran yang perlu dibuka (NIHIL)");
  });

  it("laporan pembukaan pemblokiran mengikuti formulir Lamp 2 BI: satu berita acara per nasabah, tembusan hanya BI", () => {
    const html = buildLaporanPembukaanHtml({
      company, reportNumber: "4", place: "Cianjur", reportDate: at, signer, police: { ...police, kind: "PENGHAPUSAN" }, witness: { name: "Saksi Uji", position: "Petugas APU PPT" },
      unblocked: [{ fullName: "Muasih Fiktif", unblockedAt: at }, { fullName: "Nama Dua", unblockedAt: at }],
    });
    expect(html).toContain("Laporan Pembukaan Pemblokiran");
    expect(html).toContain("telah dilakukan\n  pembukaan pemblokiran seluruh aset/dana atas nama Muasih Fiktif, Nama Dua");
    expect(html.match(/PEMBUKAAN PEMBLOKIRAN<\/h3>/g)).toHaveLength(2);
    expect(html).toContain("Indonesia Nomor R/7/III/RES.6.1./2026/Densus di hadapan saksi");
    expect(html).not.toContain("PPATK");
  });

  it("kota kepala surat diambil dari bagian terakhir alamat", () => {
    expect(placeFromAddress("JL. Mangunsarkoro NO.35 Solokpandan. Cianjur")).toBe("Cianjur");
    expect(placeFromAddress("Jl. Sudirman 1, Kota Bandung 40111")).toBe("Bandung");
  });

  it("Laporan Pemblokiran: satu surat pengantar + satu berita acara per nasabah, teks nasabah di-escape", () => {
    const html = buildLaporanPemblokiranHtml({
      company, reportNumber: "002/DTTOT/XI/2026", place: "Jakarta", reportDate: at, blockedAt: at, signer, police,
      witness: { name: "Saksi Uji", position: "Petugas APU PPT" }, listNumber: "DTTOT/P-25/X/RES.6.1./2026",
      matched: [{ fullName: "Budi <b>Santoso</b>", placeOfBirth: "Bandung", dateOfBirth: "1980-01-02", occupation: "Wiraswasta", address: "Jl. A" }, { fullName: "Nasabah Dua" }],
    });
    expect(html.match(/BERITA ACARA PEMBLOKIRAN SECARA SERTA MERTA/g)).toHaveLength(2);
    expect(html).toContain("Budi &lt;b&gt;Santoso&lt;/b&gt;");
    expect(html).not.toContain("<b>Santoso</b>");
    expect(html).toContain("atas DTTOT Nomor DTTOT/P-25/X/RES.6.1./2026");
  });
});
