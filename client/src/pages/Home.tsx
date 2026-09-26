import { PublicServicePlanner } from "@/components/PublicServicePlanner";
import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { brandInitials, brandName } from "@/components/shell/brand";
import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { latestPublicRateEffectiveAt, sortPublicRates } from "@shared/publicRates";
import { useEffect, useMemo } from "react";
import { PublicRateTable } from "./home/PublicRateTable";
import { AnnouncementsSection, FraudNotice, PublicContactSection, PublicFaqSection } from "./home/PublicSections";

const updatedFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/**
 * Halaman kurs publik. Tidak ada nama, telepon, alamat, maupun FAQ yang ditulis mati: semuanya dari
 * Profil Perusahaan lewat `publicContent.profile`, bagian kosong disembunyikan (spec 2026-09-26 §4).
 */
export default function Home() {
  const profile = usePublicProfile();
  const rates = trpc.rates.activeRates.useQuery();
  const announcements = trpc.publicContent.announcements.useQuery();
  const sorted = useMemo(() => sortPublicRates(rates.data ?? []), [rates.data]);
  const latest = useMemo(() => latestPublicRateEffectiveAt(sorted), [sorted]);
  const data = profile.data;

  useEffect(() => {
    if (!data) return;
    if (data.setupRequired) window.location.assign("/siapkan");
    else if (!data.publicPageEnabled) window.location.assign("/login");
  }, [data]);

  if (profile.isLoading || data?.setupRequired || data?.publicPageEnabled === false) return <main aria-busy="true" className="min-h-screen bg-paper" />;
  const brand = brandName({ tradingName: data?.tradingName });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-ink bg-surface-raised">
        <div className="mx-auto flex h-header max-w-5xl items-center justify-between gap-3 px-gutter">
          <span className="flex min-w-0 items-center gap-2">
            {data?.logoUrl
              ? <img src={data.logoUrl} alt="" className="size-8 rounded-lg border-2 border-ink bg-surface-raised object-contain" />
              : <span aria-hidden className="flex size-8 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>}
            <span className="truncate font-heading text-body font-extrabold">{brand}</span>
          </span>
          <a href="/login" className={`inline-flex shrink-0 items-center ${OUTLINE_BUTTON}`}>Masuk staf</a>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-gutter py-6">
        <section aria-labelledby="kurs-hari-ini">
          <h1 id="kurs-hari-ini" className="font-heading text-title font-extrabold tracking-tight">Kurs {brand} hari ini</h1>
          <p className="mt-1 text-body text-ink-muted">{latest ? `Diperbarui ${updatedFormat.format(latest)} WIB. ` : ""}Kurs bersifat indikatif; petugas mengonfirmasi harga dan ketersediaan sebelum transaksi.</p>
          <div className="mt-3"><PublicRateTable rates={rates.data ?? []} isLoading={rates.isLoading} isError={rates.isError} onRetry={() => rates.refetch()} /></div>
        </section>
        {sorted.length ? (
          <section aria-labelledby="rencana">
            <h2 id="rencana" className="font-heading text-body font-extrabold">Rencanakan kunjungan Anda</h2>
            <p className="mt-0.5 text-body text-ink-muted">Perkirakan kebutuhan Anda, lalu minta konfirmasi. Ini bukan pemesanan maupun transaksi.</p>
            <div className="mt-2"><PublicServicePlanner rates={sorted} /></div>
          </section>
        ) : null}
        <AnnouncementsSection items={announcements.data ?? []} />
        <PublicContactSection profile={data ?? {}} />
        <FraudNotice text={data?.fraudWarning} />
        <PublicFaqSection faq={data?.publicFaq} />
      </main>
      <footer className="border-t-2 border-ink px-gutter py-4 text-center text-label text-ink-subtle">{brand}</footer>
    </div>
  );
}
