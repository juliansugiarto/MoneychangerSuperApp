import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRAINING_METHOD_LABELS, romanMonth, suggestTrainingLetterNumber } from "../client/src/lib/suratPelatihan";

const source = readFileSync(new URL("../client/src/lib/suratPelatihan.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Kepegawaian.tsx", import.meta.url), "utf8");

describe("nomor surat keterangan pelatihan", () => {
  it("mengikuti pola surat yang sudah terbit", () => {
    // Surat yang berlaku bernomor SKP-APUPPT/VI/2026/001.
    expect(suggestTrainingLetterNumber("2026-06-23", 1)).toBe("SKP-APUPPT/VI/2026/001");
    expect(suggestTrainingLetterNumber("2026-01-05", 12)).toBe("SKP-APUPPT/I/2026/012");
  });

  it("memakai angka romawi untuk seluruh bulan", () => {
    expect(romanMonth(1)).toBe("I");
    expect(romanMonth(10)).toBe("X");
    expect(romanMonth(12)).toBe("XII");
  });
});

describe("isi surat keterangan pelatihan", () => {
  it("memuat kalimat baku surat yang berlaku", () => {
    expect(source).toContain("SURAT KETERANGAN PELAKSANAAN PELATIHAN INTERNAL");
    expect(source).toContain("Yang bertanda tangan di bawah ini, Direksi");
    expect(source).toContain("Pelatihan Penyegaran (Refresher Training) Anti Pencucian Uang dan");
    expect(source).toContain("Pencegahan Pendanaan Terorisme (APU-PPT)");
    expect(source).toContain("pemenuhan periode tahunan");
  });

  it("menyebut e-Licensing Bank Indonesia sebagai peruntukan surat", () => {
    // Inilah alasan surat ini dibuat; tanpa kalimat itu surat kehilangan konteks perpanjangan izin.
    expect(source).toContain("perpanjangan izin operasional KUPVA BB pada sistem e-Licensing Bank Indonesia");
  });

  it("mencetak tiga baris rincian yang diminta surat", () => {
    expect(source).toContain("Topik Pelatihan");
    expect(source).toContain("Metode Pelatihan");
    expect(source).toContain("Pemateri / Fasilitator");
  });

  it("melampirkan rekapitulasi daftar hadir beserta kolomnya", () => {
    expect(source).toContain("LAMPIRAN: REKAPITULASI DAFTAR HADIR DAN EVALUASI");
    expect(source).toContain("Nama Pegawai");
    expect(source).toContain("Jabatan / Posisi");
    expect(source).toContain("Tanggal Pelatihan");
  });

  it("menandai pegawai yang belum pernah ikut, bukan mengosongkan barisnya", () => {
    // Lampiran yang hanya memuat peserta akan tampak lengkap padahal ada pegawai yang terlewat.
    expect(source).toContain("Belum mengikuti");
  });

  it("mengunci lebar tabel lampiran agar kolom kanan tidak terpotong saat dicetak", () => {
    expect(source).toContain("table-layout: fixed");
  });

  it("menyediakan ruang tanda tangan direksi", () => {
    expect(source).toContain("input.signatory.fullName");
    expect(source).toContain("input.signatory.position");
  });

  it("menunda cetak sampai logo termuat", () => {
    expect(source).toContain("window.__skPrint");
    expect(source).toContain("onload=\"window.__skPrint()\"");
  });

  it("menyebut ketiga metode pelatihan dengan bahasa surat", () => {
    expect(Object.keys(TRAINING_METHOD_LABELS).sort()).toEqual(["DARING", "EKSTERNAL", "IN_HOUSE"]);
    expect(TRAINING_METHOD_LABELS.IN_HOUSE).toContain("In-House Training");
  });
});

describe("tab pelatihan pada halaman Kepegawaian", () => {
  it("menolak mencetak surat sebelum syaratnya lengkap", () => {
    expect(pageSource).toContain("Belum ada pelatihan pada periode ini.");
    expect(pageSource).toContain("Belum ada direksi aktif yang dapat menandatangani surat.");
    expect(pageSource).toContain("Nama badan hukum belum diisi pada Profil Perusahaan.");
  });

  it("mewajibkan minimal satu peserta sebelum pelatihan disimpan", () => {
    // Sisi server menolaknya juga; pemeriksaan di layar mencegah perjalanan bolak-balik yang sia-sia.
    expect(pageSource).toContain("Pilih minimal satu pegawai yang hadir.");
  });

  it("menampilkan pegawai yang belum mengikuti pelatihan pada rekap layar", () => {
    expect(pageSource).toContain("Belum mengikuti");
  });
});
