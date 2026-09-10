/**
 * Aturan pemblokiran nasabah berisiko tinggi — Pasal 32 ayat (5) dan (6) PBI 10/2024.
 *
 * Tinggal di `shared/` karena dua pihak wajib sepakat kata demi kata: layar transaksi yang
 * memperingatkan petugas sebelum ia mengisi seluruh bon, dan `createTransaction` yang menolak bon
 * itu di penulisnya. Peringatan layar yang berbeda dari penolakan server adalah cara terbaik
 * membuat petugas mengisi borang panjang untuk kemudian ditolak tanpa mengerti sebabnya.
 */

export type HighRiskDecision = "BELUM" | "DISETUJUI" | "DITOLAK";
export type CustomerRiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** Bentuk minimal yang dibutuhkan gerbang: tingkat risiko dan keputusannya, bukan seluruh nasabah. */
export type HighRiskGateCustomer = { riskLevel: CustomerRiskLevel; highRiskDecision: HighRiskDecision };

/**
 * Alasan penolakan bon bagi satu nasabah, atau `null` bila ia boleh dipakai.
 *
 * `label` menyebut pihak mana yang tertahan — nasabah transaksi atau pihak kuasa/wakilnya —
 * supaya petugas tidak perlu menebak profil mana yang harus diurus.
 *
 * `DITOLAK` dan `BELUM` sengaja berbunyi berbeda: menyuruh menunggu keputusan yang justru sudah
 * dijatuhkan akan membuat petugas menunggu sesuatu yang tidak akan datang.
 */
export function customerHighRiskDenial(customer: HighRiskGateCustomer, label = "Nasabah"): string | null {
  if (customer.riskLevel !== "HIGH") return null;
  if (customer.highRiskDecision === "DISETUJUI") return null;
  if (customer.highRiskDecision === "DITOLAK") {
    return `${label} berisiko tinggi ini ditolak Pemegang Saham (SHAREHOLDER); hubungan usahanya dihentikan dan bon baru tidak dapat dibuat atas namanya.`;
  }
  return `${label} berisiko tinggi ini belum diputuskan Pemegang Saham (SHAREHOLDER). Mintakan keputusan persetujuan pada profil nasabahnya sebelum membuat bon.`;
}

/**
 * Penyaringan terakhir dijalankan terhadap daftar yang sudah tersusul daftar yang lebih baru.
 *
 * Inilah yang membedakan panel riwayat dari hiasan: daftar sanksi yang baru masuk tidak ada gunanya
 * bila nasabahnya masih dinilai terhadap daftar kemarin. `latestImportAt` null berarti belum ada
 * daftar sama sekali — tidak ada yang dapat dikatakan usang. `listSnapshotAt` null padahal daftarnya
 * sudah ada berarti penyaringannya berlangsung sebelum daftar mana pun dimuat: usang.
 */
export function isScreeningStale(listSnapshotAt: Date | null, latestImportAt: Date | null): boolean {
  if (!latestImportAt) return false;
  if (!listSnapshotAt) return true;
  return listSnapshotAt.getTime() < latestImportAt.getTime();
}
