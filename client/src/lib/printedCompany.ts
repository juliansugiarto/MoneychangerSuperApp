/**
 * Identitas perusahaan untuk setiap cetakan (nota, arsip penutupan, paket pelaporan, register
 * insidental, hasil latihan). Hanya dari Profil Perusahaan: isian yang kosong dicetak sebagai catatan
 * "belum diisi" yang jelas terlihat, tidak pernah diganti identitas perusahaan lain — aplikasi ini
 * dipasang di banyak money changer.
 */
export const MISSING_NAME = "Nama perusahaan belum diisi — lengkapi Profil Perusahaan";
export const MISSING_ADDRESS = "Alamat belum diisi — lengkapi Profil Perusahaan";

type CompanyFields = { legalEntityName?: string | null; tradingName?: string | null; address?: string | null; phone?: string | null } | null | undefined;

export function printedCompany(profile: CompanyFields): { legalName: string; tradingName: string; address: string; phone: string | null } {
  const legal = profile?.legalEntityName?.trim();
  const trading = profile?.tradingName?.trim();
  const legalName = legal || trading || MISSING_NAME;
  return {
    legalName,
    tradingName: trading || legalName,
    address: profile?.address?.trim() || MISSING_ADDRESS,
    phone: profile?.phone?.trim() || null,
  };
}

/** Untuk teks yang disisipkan ke dokumen cetak berbentuk string HTML. */
export function escapePrintText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
