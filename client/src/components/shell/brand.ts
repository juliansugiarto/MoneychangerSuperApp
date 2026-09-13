/** Nama produk bila Profil Perusahaan belum diisi — shell tidak lagi menulis mati nama satu perusahaan. */
export const PRODUCT_NAME = "Aplikasi Valuta";

const LEGAL_FORM_WORDS = new Set(["PT", "CV", "TBK", "PT.", "CV."]);

export function brandName(profile: { tradingName?: string | null; legalEntityName?: string | null } | null | undefined): string {
  const trading = profile?.tradingName?.trim();
  if (trading) return trading;
  const legal = profile?.legalEntityName?.trim();
  return legal || PRODUCT_NAME;
}

export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => !LEGAL_FORM_WORDS.has(word.toUpperCase()));
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}
