import { LoadingState, ErrorState } from "@/components/patterns/PageStates";
import { BOLD_BUTTON } from "@/components/patterns/tebal";
import { brandName } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AuthFrame } from "./auth/AuthFrame";
import { SetupWizard } from "./setup/SetupWizard";

export default function Setup() {
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  // Sesudah berhasil, profil publik akan berkata "sudah disiapkan"; wizard tetap tampil sampai pemilik
  // menyimpan kodenya.
  const [started, setStarted] = useState(false);
  const complete = trpc.setup.complete.useMutation({ onError: (failure) => setError(failure.message) });
  const brand = brandName({ tradingName: profile.data?.tradingName });

  if (profile.isLoading) return <main className="grid min-h-screen place-items-center bg-paper px-4"><div className="w-full max-w-2xl"><LoadingState label="Memeriksa keadaan instalasi…" /></div></main>;
  if (profile.isError) {
    return <main className="grid min-h-screen place-items-center bg-paper px-4"><div className="w-full max-w-2xl"><ErrorState what="Keadaan instalasi tidak dapat dibaca." nextStep="Pastikan server dan basis data berjalan, lalu coba lagi." onRetry={() => profile.refetch()} /></div></main>;
  }
  if (!started && profile.data && !profile.data.setupRequired) {
    return (
      <AuthFrame brand={brand} logoUrl={profile.data.logoUrl} title="Perusahaan ini sudah disiapkan" description="Masuk dengan akun pemilik atau akun yang diberikan pemilik.">
        <Button className={`w-full ${BOLD_BUTTON}`} onClick={() => window.location.assign("/login")}>Ke halaman masuk</Button>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame brand={brand} logoUrl={profile.data?.logoUrl ?? null} title="Siapkan perusahaan Anda" description="Sekali saja, untuk pemilik usaha. Butuh sekitar tiga menit." width="wide">
      <SetupWizard
        brand={brand}
        isPending={complete.isPending}
        errorMessage={error}
        onComplete={async (payload) => {
          setError(null);
          setStarted(true);
          const result = await complete.mutateAsync(payload);
          return { recoveryCodes: result.recoveryCodes };
        }}
        onFinish={() => window.location.assign("/operasional")}
      />
    </AuthFrame>
  );
}
