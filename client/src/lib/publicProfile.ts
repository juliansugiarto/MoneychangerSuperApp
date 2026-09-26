import { brandName } from "@/components/shell/brand";
import { trpc } from "./trpc";
import { useCompanyTheme } from "./useCompanyTheme";

/**
 * Nama usaha untuk bingkai layar tanpa akun. `null` selama profil masih dimuat — bingkai lalu
 * menampilkan tempat kosong, bukan nama produk yang sesaat kemudian berganti nama perusahaan.
 */
export function authBrand(profile: { data?: { tradingName?: string | null } | null; isError: boolean }): string | null {
  if (profile.data) return brandName({ tradingName: profile.data.tradingName });
  return profile.isError ? brandName(null) : null;
}

/** Profil publik untuk layar tanpa akun (halaman depan, masuk, pulihkan, wizard), sekaligus memasang palet perusahaan. */
export function usePublicProfile() {
  const query = trpc.publicContent.profile.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  useCompanyTheme(query.data);
  return query;
}
