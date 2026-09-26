import { authBrand, usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "./auth/AuthFrame";
import { RecoverForm } from "./auth/RecoverForm";

export default function Recover() {
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  const recover = trpc.auth.recover.useMutation({
    onSuccess: () => {
      toast.success("Akun dipulihkan. Kode yang Anda pakai kini hangus — buat kode baru dari menu pengguna bila sisanya menipis.");
      window.location.assign("/operasional");
    },
    onError: (failure) => setError(failure.message),
  });
  return (
    <AuthFrame brand={authBrand(profile)} logoUrl={profile.data?.logoUrl ?? null} title="Pulihkan akun pemilik" description="Hanya untuk Pemegang Saham. Seluruh sesi lama akun ini akan keluar.">
      <RecoverForm onSubmit={(values) => { setError(null); recover.mutate(values); }} isPending={recover.isPending} errorMessage={error} />
    </AuthFrame>
  );
}
