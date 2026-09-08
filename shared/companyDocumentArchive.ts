/**
 * Penilaian masa berlaku dokumen arsip perusahaan — murni, tanpa basis data dan tanpa membaca jam.
 *
 * Pemanggilnya yang menurunkan "hari ini" dari zona waktu operasional dan menyerahkannya sebagai
 * kunci `YYYY-MM-DD`. Fungsi di sini tidak pernah memanggil `new Date()` sendiri: status masa
 * berlaku yang berubah menurut jam mesin yang kebetulan menjalankannya adalah status yang tidak
 * dapat diuji maupun dipertanggungjawabkan kepada pemeriksa.
 */

/** Keputusan pengguna 8 September 2026: dokumen yang akan kedaluwarsa dalam 30 hari sudah menjadi pekerjaan yang menunggu. */
export const ARCHIVE_EXPIRY_WARNING_DAYS = 30;

export const companyDocumentCategoryLabels = {
  SOP: "SOP",
  KEBIJAKAN_INTERNAL: "Kebijakan internal",
  SURAT_BI: "Surat-menyurat Bank Indonesia",
  NOTULEN_RAPAT: "Notulen rapat",
  KORESPONDENSI_REGULATOR: "Korespondensi regulator",
  LAINNYA: "Lainnya",
} as const;

export type CompanyDocumentCategory = keyof typeof companyDocumentCategoryLabels;

export type ArchiveValidityStatus = "BERLAKU" | "AKAN_KEDALUWARSA" | "KEDALUWARSA" | "BELUM_BERLAKU";
export type ArchiveWorklistReason = "KEDALUWARSA" | "AKAN_KEDALUWARSA" | "TIDAK_ADA_VERSI_BERLAKU";

export const archiveValidityLabels: Record<ArchiveValidityStatus, string> = {
  BERLAKU: "Berlaku",
  AKAN_KEDALUWARSA: "Akan kedaluwarsa",
  KEDALUWARSA: "Kedaluwarsa",
  BELUM_BERLAKU: "Belum berlaku",
};

export const archiveWorklistReasonLabels: Record<ArchiveWorklistReason, string> = {
  KEDALUWARSA: "Masa berlakunya sudah terlampaui",
  AKAN_KEDALUWARSA: `Masa berlakunya berakhir dalam ${ARCHIVE_EXPIRY_WARNING_DAYS} hari atau kurang`,
  TIDAK_ADA_VERSI_BERLAKU: "Versi berjalan baru berlaku di kemudian hari, sehingga tidak ada versi yang berlaku hari ini",
};

export type ArchiveValidityInput = { validFrom: Date; validUntil: Date | null };
export type ArchiveWorklistInput = ArchiveValidityInput & { deactivatedAt: Date | null };

/**
 * Kunci `YYYY-MM-DD` sebuah nilai kolom `date`, dibaca dengan penggetah WAKTU LOKAL proses.
 *
 * Penggetah lokal bukan kelalaian melainkan syaratnya: driver MySQL membangun nilai kolom `date`
 * sebagai tengah malam waktu lokal proses, sehingga hanya penggetah lokal yang mengembalikan
 * tanggal yang sama dengan yang tertulis di kolomnya. `toISOString().slice(0, 10)` atas nilai yang
 * sama memundurkan tanggalnya satu hari di WIB — dan pemunduran itulah yang membuat baris jatuh di
 * sisi salah batasnya tanpa terlihat dari layar mana pun.
 *
 * "Hari ini" tidak boleh diturunkan lewat fungsi ini; ia bukan nilai kolom `date` melainkan sebuah
 * instan, dan zona yang menentukannya adalah zona operasional gerai. Pakai `operationalDateKey`.
 */
export function archiveDateKey(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Selisih hari kalender antara dua kunci tanggal, dihitung atas tanggalnya dan bukan atas selisih milidetik — sebuah hari tidak selalu 24 jam. */
export function archiveDayDifference(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Status masa berlaku sebuah versi dokumen pada tanggal acuan.
 *
 * `validUntil` adalah tanggal **terakhir** dokumen berlaku, bukan tanggal pertama ia tidak berlaku:
 * dokumen yang berakhir hari ini masih berlaku hari ini. `validUntil` kosong berarti berlaku sampai
 * diganti, bukan kedaluwarsa — kekosongan itu keadaan yang sah, dan memperlakukannya sebagai
 * kedaluwarsa akan memenuhi worklist dengan dokumen yang tidak bermasalah.
 */
export function assessArchiveValidity(entry: ArchiveValidityInput, asOfKey: string): ArchiveValidityStatus {
  const fromKey = archiveDateKey(entry.validFrom);
  // Diperiksa lebih dulu daripada kedaluwarsa: versi yang belum berlaku dan sekaligus bertanggal
  // berakhir di masa lalu adalah tanggal yang keliru diisi, dan yang perlu terlihat adalah bahwa
  // tidak ada versi yang berlaku — bukan sebuah kedaluwarsa biasa yang menyamarkan sebabnya.
  if (archiveDayDifference(asOfKey, fromKey) > 0) return "BELUM_BERLAKU";
  if (!entry.validUntil) return "BERLAKU";

  const remainingDays = archiveDayDifference(asOfKey, archiveDateKey(entry.validUntil));
  if (remainingDays < 0) return "KEDALUWARSA";
  return remainingDays <= ARCHIVE_EXPIRY_WARNING_DAYS ? "AKAN_KEDALUWARSA" : "BERLAKU";
}

/**
 * Alasan sebuah dokumen menjadi pekerjaan yang menunggu, atau `null` bila tidak.
 *
 * Dokumen yang sudah dinonaktifkan tidak pernah menghasilkan alasan, dan itu diputuskan di sini
 * alih-alih diserahkan ke pemanggilnya: worklist yang menuntut pekerjaan atas dokumen yang sengaja
 * ditarik akan mengajari penggunanya mengabaikan worklist itu sendiri.
 */
export function archiveWorklistReason(entry: ArchiveWorklistInput, asOfKey: string): ArchiveWorklistReason | null {
  if (entry.deactivatedAt) return null;
  const status = assessArchiveValidity(entry, asOfKey);
  if (status === "KEDALUWARSA") return "KEDALUWARSA";
  if (status === "AKAN_KEDALUWARSA") return "AKAN_KEDALUWARSA";
  if (status === "BELUM_BERLAKU") return "TIDAK_ADA_VERSI_BERLAKU";
  return null;
}
