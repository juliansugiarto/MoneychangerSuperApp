import { trpc } from "./trpc";
import { useCompanyTheme } from "./useCompanyTheme";

/** Profil publik untuk layar tanpa akun (halaman depan, masuk, pulihkan, wizard), sekaligus memasang palet perusahaan. */
export function usePublicProfile() {
  const query = trpc.publicContent.profile.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  useCompanyTheme(query.data);
  return query;
}
