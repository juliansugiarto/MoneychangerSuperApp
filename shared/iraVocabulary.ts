/**
 * Kosakata tertutup Bank Indonesia untuk Individual Risk Assessment (IRA).
 *
 * Struktur di berkas ini disalin dari lembar `C1. Form KUPVA BB` pada template resmi — **daftarnya,
 * bukan angkanya.** Jumlah nasabah dan omzet pada workbook adalah data operasional PT IBV dan tidak
 * ikut masuk repo; yang dipakai di sini hanya nama kategori, bentuk badan hukum, jalur distribusi,
 * dan provinsi.
 *
 * Murni: tanpa basis data, tanpa jam, tanpa impor apa pun. Skema Drizzle dan skema Zod sama-sama
 * memakai tuple `*_VALUES` di bawah supaya satu daftar berlaku untuk penyimpanan dan validasi.
 * Tuple-nya bertipe literal, bukan `string[]`, agar `mysqlEnum` dan `z.enum` menghasilkan union
 * kode yang sebenarnya — kolom bertipe `string` akan meloloskan kode salah ketik sampai runtime.
 */

/**
 * Kategori pekerjaan nasabah perorangan menurut Form C1.
 *
 * Seluruh kategori template disalin apa adanya, termasuk yang pada periode berjalan bernilai nol —
 * kategori yang tidak dipakai tahun ini tetap dipakai tahun depan, dan daftar yang dipangkas
 * membuat pelaporan tidak lagi sebanding dengan formulir BI.
 *
 * `LAINNYA` **bukan tempat pembuangan.** Ia kategori tersendiri yang ikut dihitung dan terlihat di
 * layar. Nasabah yang belum dikategorikan tetap `null`, bukan `LAINNYA`; menebak kategori dari teks
 * bebas `customers.occupation` berarti mengarang data nasabah.
 */
export const IRA_OCCUPATION_CATEGORY_LABELS = {
  PEJABAT_NEGARA: "Pejabat Negara",
  WIRAUSAHA: "Wirausaha/Wiraswasta",
  KARYAWAN_SWASTA: "Karyawan Swasta",
  PNS_ASN: "PNS/ASN (termasuk pensiunan)",
  PROFESI_KEUANGAN_LAINNYA: "Profesi Keuangan Lainnya",
  PROFESIONAL: "Profesional",
  PEGAWAI_BUMN_BUMD_BUMS_BUMDES: "Pengurus dan Pegawai BUMN/BUMD/BUMS/BUMDes",
  IBU_RUMAH_TANGGA: "Ibu Rumah Tangga",
  TNI: "TNI",
  POLRI: "Polri",
  PELAJAR_MAHASISWA: "Pelajar/Mahasiswa",
  PENGURUS_YAYASAN_PERKUMPULAN: "Pengurus atau Pegawai Yayasan/Perkumpulan",
  ARTIS_CONTENT_CREATOR_INFLUENCER: "Artis/Content Creator/Influencer",
  PENGAJAR: "Pengajar",
  ORMAS_LSM: "Pengurus/Pegawai/Relawan Ormas atau LSM",
  SOPIR: "Sopir",
  ASISTEN_RUMAH_TANGGA: "Asisten Rumah Tangga",
  BURUH: "Buruh",
  TENAGA_KEAMANAN: "Tenaga Keamanan",
  ATLET: "Atlet",
  PEMUKA_AGAMA: "Pemuka/Tokoh Agama",
  PENGURUS_PARTAI_POLITIK: "Pengurus Partai Politik",
  LAINNYA: "Lainnya",
} as const;

export type IraOccupationCategory = keyof typeof IRA_OCCUPATION_CATEGORY_LABELS;

export const IRA_OCCUPATION_CATEGORIES = Object.keys(IRA_OCCUPATION_CATEGORY_LABELS) as IraOccupationCategory[];

export const IRA_OCCUPATION_CATEGORY_VALUES = IRA_OCCUPATION_CATEGORIES as unknown as [IraOccupationCategory, ...IraOccupationCategory[]];

/**
 * Bentuk badan hukum nasabah korporasi menurut Form C1.
 *
 * `PT` dan `PERUSAHAAN_PERSEORANGAN` **sengaja terpisah.** Parameter PPSPM 3c menanyakan proporsi
 * nasabah PT **non-UMKM**; menggabungkan perusahaan perseorangan (UMKM per PP 7/2021) ke dalam `PT`
 * membuat parameter itu tidak mungkin dihitung dari basis data.
 *
 * `ORMAS_TERDAFTAR` dan `ORMAS_TIDAK_TERDAFTAR` juga terpisah karena status pendaftarannya sendiri
 * yang ditanyakan parameter organisasi nirlaba, bukan sekadar jenis badannya.
 */
export const IRA_LEGAL_FORM_LABELS = {
  PT: "Perseroan Terbatas (termasuk BUMN/BUMD/BUMS)",
  PERUSAHAAN_PERSEORANGAN: "Perusahaan Perseorangan (termasuk UMKM per PP 7/2021)",
  SOCIAL_ENTERPRISE: "Social Enterprise",
  CV: "Persekutuan Komanditer (CV)",
  FIRMA: "Firma",
  PERSEKUTUAN_PERDATA: "Persekutuan Perdata",
  KOPERASI: "Koperasi",
  YAYASAN: "Yayasan",
  PERKUMPULAN: "Perkumpulan",
  ORMAS_TERDAFTAR: "Organisasi Kemasyarakatan Terdaftar",
  ORMAS_TIDAK_TERDAFTAR: "Organisasi Kemasyarakatan Tidak Terdaftar",
} as const;

export type IraLegalForm = keyof typeof IRA_LEGAL_FORM_LABELS;

export const IRA_LEGAL_FORMS = Object.keys(IRA_LEGAL_FORM_LABELS) as IraLegalForm[];

export const IRA_LEGAL_FORM_VALUES = IRA_LEGAL_FORMS as unknown as [IraLegalForm, ...IraLegalForm[]];

/**
 * Jalur distribusi transaksi. Bawaannya `KANTOR` pada `exchange_transactions` — sebagian besar bon
 * memang dilayani di gerai, dan petugas kasir tidak dipaksa memilih hal yang hampir selalu sama.
 */
export const IRA_DISTRIBUTION_CHANNEL_LABELS = {
  KANTOR: "Kantor/gerai",
  LAYANAN_DELIVERY: "Layanan delivery",
  ONLINE_MERCHANT: "Online/merchant",
} as const;

export type IraDistributionChannel = keyof typeof IRA_DISTRIBUTION_CHANNEL_LABELS;

export const IRA_DISTRIBUTION_CHANNELS = Object.keys(IRA_DISTRIBUTION_CHANNEL_LABELS) as IraDistributionChannel[];

export const IRA_DISTRIBUTION_CHANNEL_VALUES = IRA_DISTRIBUTION_CHANNELS as unknown as [IraDistributionChannel, ...IraDistributionChannel[]];

/**
 * 34 provinsi sebagaimana tertulis pada template C1.
 *
 * Berkode garis bawah seperti seluruh kosakata IRA lain — ditetapkan pengguna 9 September 2026,
 * mengganti bentuk kebab pada rancangan awal. Provinsi yang berbeda bentuk sendirian hanya menjadi
 * pengecualian yang harus diingat setiap pemanggil.
 *
 * Daftarnya mengikuti template, bukan pemekaran wilayah terbaru: parameter Wilayah Geografis
 * dinilai terhadap peringkat risiko provinsi yang diterbitkan pada daftar yang sama, sehingga
 * menambah provinsi baru sendiri membuat baris klasifikasi tidak punya pasangan pada formulirnya.
 */
export const IRA_PROVINCE_LABELS = {
  ACEH: "Aceh",
  SUMATERA_UTARA: "Sumatera Utara",
  SUMATERA_BARAT: "Sumatera Barat",
  RIAU: "Riau",
  JAMBI: "Jambi",
  SUMATERA_SELATAN: "Sumatera Selatan",
  BENGKULU: "Bengkulu",
  LAMPUNG: "Lampung",
  KEPULAUAN_BANGKA_BELITUNG: "Kepulauan Bangka Belitung",
  KEPULAUAN_RIAU: "Kepulauan Riau",
  DKI_JAKARTA: "DKI Jakarta",
  JAWA_BARAT: "Jawa Barat",
  JAWA_TENGAH: "Jawa Tengah",
  DI_YOGYAKARTA: "DI Yogyakarta",
  JAWA_TIMUR: "Jawa Timur",
  BANTEN: "Banten",
  BALI: "Bali",
  NUSA_TENGGARA_BARAT: "Nusa Tenggara Barat",
  NUSA_TENGGARA_TIMUR: "Nusa Tenggara Timur",
  KALIMANTAN_BARAT: "Kalimantan Barat",
  KALIMANTAN_TENGAH: "Kalimantan Tengah",
  KALIMANTAN_SELATAN: "Kalimantan Selatan",
  KALIMANTAN_TIMUR: "Kalimantan Timur",
  KALIMANTAN_UTARA: "Kalimantan Utara",
  SULAWESI_UTARA: "Sulawesi Utara",
  SULAWESI_TENGAH: "Sulawesi Tengah",
  SULAWESI_SELATAN: "Sulawesi Selatan",
  SULAWESI_TENGGARA: "Sulawesi Tenggara",
  GORONTALO: "Gorontalo",
  SULAWESI_BARAT: "Sulawesi Barat",
  MALUKU: "Maluku",
  MALUKU_UTARA: "Maluku Utara",
  PAPUA_BARAT: "Papua Barat",
  PAPUA: "Papua",
} as const;

export type IraProvince = keyof typeof IRA_PROVINCE_LABELS;

export const IRA_PROVINCES = Object.keys(IRA_PROVINCE_LABELS) as IraProvince[];

export const IRA_PROVINCE_VALUES = IRA_PROVINCES as unknown as [IraProvince, ...IraProvince[]];

/** Jenis nasabah; menentukan ruas mana yang berlaku pada borang nasabah. */
export const IRA_CUSTOMER_TYPE_LABELS = {
  INDIVIDU: "Perorangan",
  BADAN_USAHA: "Badan usaha",
} as const;

export type IraCustomerType = keyof typeof IRA_CUSTOMER_TYPE_LABELS;

export const IRA_CUSTOMER_TYPES = Object.keys(IRA_CUSTOMER_TYPE_LABELS) as IraCustomerType[];

export const IRA_CUSTOMER_TYPE_VALUES = IRA_CUSTOMER_TYPES as unknown as [IraCustomerType, ...IraCustomerType[]];
