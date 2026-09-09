import { describe, expect, it } from "vitest";
import {
  IRA_CUSTOMER_TYPES,
  IRA_CUSTOMER_TYPE_LABELS,
  IRA_DISTRIBUTION_CHANNELS,
  IRA_DISTRIBUTION_CHANNEL_LABELS,
  IRA_LEGAL_FORMS,
  IRA_LEGAL_FORM_LABELS,
  IRA_OCCUPATION_CATEGORIES,
  IRA_OCCUPATION_CATEGORY_LABELS,
  IRA_PROVINCES,
  IRA_PROVINCE_LABELS,
} from "./iraVocabulary";

/**
 * Tugas ini isinya menyalin daftar dari template BI, sehingga kesalahan yang paling mungkin adalah
 * salin-tempel yang meleset: kode kembar yang diam-diam menelan satu kategori, label kembar yang
 * membuat dua baris tak terbedakan di layar, atau kode tanpa label. Uji di bawah murah dan
 * menangkap ketiganya.
 */
const DAFTAR: { nama: string; kode: readonly string[]; label: Record<string, string>; jumlah: number }[] = [
  { nama: "kategori pekerjaan", kode: IRA_OCCUPATION_CATEGORIES, label: IRA_OCCUPATION_CATEGORY_LABELS, jumlah: 23 },
  { nama: "bentuk badan hukum", kode: IRA_LEGAL_FORMS, label: IRA_LEGAL_FORM_LABELS, jumlah: 11 },
  { nama: "jalur distribusi", kode: IRA_DISTRIBUTION_CHANNELS, label: IRA_DISTRIBUTION_CHANNEL_LABELS, jumlah: 3 },
  { nama: "provinsi", kode: IRA_PROVINCES, label: IRA_PROVINCE_LABELS, jumlah: 34 },
  { nama: "jenis nasabah", kode: IRA_CUSTOMER_TYPES, label: IRA_CUSTOMER_TYPE_LABELS, jumlah: 2 },
];

describe.each(DAFTAR)("kosakata IRA — $nama", ({ kode, label, jumlah }) => {
  it("berkode unik", () => {
    expect(new Set(kode).size).toBe(kode.length);
  });

  it("setiap kode punya label yang tidak kosong", () => {
    for (const satu of kode) {
      expect(label[satu], `kode ${satu} tidak punya label`).toBeTruthy();
      expect(label[satu].trim()).not.toBe("");
    }
  });

  it("tidak ada label kembar", () => {
    const labels = kode.map((satu) => label[satu]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("panjangnya sesuai template", () => {
    expect(kode.length).toBe(jumlah);
  });
});

describe("kosakata IRA — hal yang tidak boleh bergeser", () => {
  /** `LAINNYA` kategori tersendiri yang ikut dihitung; yang belum dikategorikan tetap `null`. */
  it("kategori pekerjaan memuat LAINNYA sebagai kategori, bukan penampung kosong", () => {
    expect(IRA_OCCUPATION_CATEGORIES).toContain("LAINNYA");
    expect(IRA_OCCUPATION_CATEGORY_LABELS.LAINNYA).toBe("Lainnya");
  });

  /** Parameter PPSPM 3c menanyakan PT non-UMKM; keduanya tergabung membuatnya tak terhitung. */
  it("PT dan PERUSAHAAN_PERSEORANGAN tetap dua nilai terpisah", () => {
    expect(IRA_LEGAL_FORMS).toContain("PT");
    expect(IRA_LEGAL_FORMS).toContain("PERUSAHAAN_PERSEORANGAN");
    expect(IRA_LEGAL_FORM_LABELS.PT).not.toBe(IRA_LEGAL_FORM_LABELS.PERUSAHAAN_PERSEORANGAN);
  });

  /** `KANTOR` adalah bawaan kolom `exchange_transactions.distributionChannel`. */
  it("jalur distribusi bawaannya ada dan berada di urutan pertama", () => {
    expect(IRA_DISTRIBUTION_CHANNELS[0]).toBe("KANTOR");
  });

  it("kode provinsi memakai kebab-uppercase tanpa spasi", () => {
    for (const kode of IRA_PROVINCES) expect(kode).toMatch(/^[A-Z]+(-[A-Z]+)*$/);
  });
});
