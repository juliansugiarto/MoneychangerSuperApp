import { PageHeader } from "@/components/patterns/PageHeader";
import { brandName } from "@/components/shell/brand";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { RegenerateRecoveryCodes } from "./setup/RegenerateRecoveryCodes";

export default function RecoveryCodes() {
  const utils = trpc.useUtils();
  const profile = trpc.companyProfile.get.useQuery();
  const me = trpc.auth.me.useQuery();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regenerate = trpc.auth.regenerateRecoveryCodes.useMutation({
    onSuccess: (result) => { setCodes(result.codes); void utils.auth.me.invalidate(); },
    onError: (failure) => setError(failure.message),
  });
  const remaining = me.data?.recoveryCodesRemaining;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Kode pemulihan pemilik"
        description={codes ? undefined : remaining === null || remaining === undefined ? undefined : `Sisa kode yang belum terpakai: ${remaining} dari 8.`}
      />
      <RegenerateRecoveryCodes
        brand={brandName(profile.data)}
        codes={codes}
        errorMessage={error}
        isPending={regenerate.isPending}
        onRegenerate={(currentPassword) => { setError(null); regenerate.mutate({ currentPassword }); }}
        onDone={() => window.location.assign("/operasional")}
      />
    </div>
  );
}
