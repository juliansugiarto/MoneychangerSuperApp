import { useAuth } from "@/_core/hooks/useAuth";
import { brandName } from "@/components/shell/brand";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { AuthFrame } from "./auth/AuthFrame";
import { LoginForm } from "./auth/LoginForm";

export default function Login() {
  const { user, loading } = useAuth();
  const profile = usePublicProfile();
  const [error, setError] = useState<string | null>(null);
  const login = trpc.auth.login.useMutation({
    onSuccess: (account) => window.location.assign(account.mustChangePassword ? "/ubah-sandi" : "/operasional"),
    onError: (failure) => setError(failure.message),
  });

  useEffect(() => {
    if (!loading && user) window.location.assign(user.mustChangePassword ? "/ubah-sandi" : "/operasional");
  }, [loading, user]);
  useEffect(() => {
    if (profile.data?.setupRequired) window.location.assign("/siapkan");
  }, [profile.data?.setupRequired]);

  return (
    <AuthFrame brand={brandName({ tradingName: profile.data?.tradingName })} logoUrl={profile.data?.logoUrl ?? null} title="Masuk" description="Pakai akun yang diberikan pemilik usaha Anda.">
      <LoginForm onSubmit={(values) => { setError(null); login.mutate(values); }} isPending={login.isPending} errorMessage={error} />
    </AuthFrame>
  );
}
