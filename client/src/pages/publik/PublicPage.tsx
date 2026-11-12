import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { describeOpeningStatus, openingStatus } from "@shared/openingStatus";
import { latestPublicRateEffectiveAt } from "@shared/publicRates";
import { DEFAULT_OPERATIONAL_TIMEZONE } from "@shared/regulatoryActionQueue";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalcSection } from "./CalcSection";
import { shortTime, useNow, wallClock } from "./clock";
import { Header } from "./Header";
import { RatesSection } from "./RatesSection";
import { ShareSection } from "./ShareSection";
import { Sky } from "./Sky";
import { SvgDefs } from "./SvgDefs";
import { TicketSection } from "./TicketSection";
import { AnnouncementSection, FaqSection, Footer, LegalSection } from "./TrustSections";
import { useCalculation } from "./useCalculation";
import { useArrival, usePageMotion } from "./usePageMotion";
import { usePublicDocument } from "./usePublicDocument";
import { faqItems, identityFrom, toRateViews, type Dir } from "./viewModel";
import { LocationSection, RulesSection } from "./VisitSections";
import "./paspor.css";
import "./paspor-app.css";

/** Kurs aktif disegarkan tiap menit; staf mengaktifkan kurs manual, halaman hanya membaca. */
export const RATE_REFRESH_MS = 60_000;

/**
 * Halaman publik "Paspor & cap" (DESIGN.md §Halaman publik; rujukan `rujukan-paspor-v3.html`). Semua isi dari data:
 * Profil Perusahaan, kurs aktif, pengumuman terbit, dan permintaan layanan sungguhan.
 */
export default function PublicPage() {
  const profile = usePublicProfile();
  const rates = trpc.rates.activeRates.useQuery(undefined, { refetchInterval: RATE_REFRESH_MS, refetchIntervalInBackground: false });
  const announcements = trpc.publicContent.announcements.useQuery();
  const data = profile.data;
  const rootRef = useRef<HTMLDivElement>(null);
  // Status Buka/Tutup cukup per 30 detik; jam berdetak hanya di kepala (render seluruh halaman tiap detik
  // terukur ±60 ms per frame pada CPU 4×).
  const now = useNow(30_000);
  const [dir, setDir] = useState<Dir>("jual");
  const [openSeq, setOpenSeq] = useState(0);
  const [highlight, setHighlight] = useState<{ code: string; seq: number } | null>(null);

  const rows = useMemo(() => rates.data ?? [], [rates.data]);
  const views = useMemo(() => toRateViews(rows), [rows]);
  const calc = useCalculation(views, dir);
  const timeZone = data?.timezone ?? DEFAULT_OPERATIONAL_TIMEZONE;
  const identity = identityFrom({ tradingName: data?.tradingName, address: data?.address });
  const phone = data?.phone?.trim() || null;
  const status = describeOpeningStatus(openingStatus(data?.openingSchedule, now, timeZone), timeZone, phone);
  const updatedAt = latestPublicRateEffectiveAt(rows);

  usePublicDocument(identity);

  useEffect(() => {
    if (!data) return;
    if (data.setupRequired) window.location.assign("/siapkan");
    else if (!data.publicPageEnabled) window.location.assign("/login");
  }, [data]);

  const latestText = useCallback(() => (updatedAt ? shortTime(wallClock(updatedAt, timeZone), timeZone) : null), [updatedAt, timeZone]);
  const redirecting = !data || data.setupRequired || data.publicPageEnabled === false;
  const ready = !profile.isLoading && !(data && redirecting);
  const arrived = useArrival(rootRef, ready, latestText, identity.name.toUpperCase().split(/\s+/).slice(0, 3));
  usePageMotion(rootRef, ready, arrived, `${views.length}:${announcements.data?.length ?? 0}:${Boolean(data?.moneyRules)}`);

  const onRateEvent = useCallback((id: string) => {
    const view = views.find((item) => item.id === id);
    if (view) setHighlight((current) => ({ code: view.code, seq: (current?.seq ?? 0) + 1 }));
  }, [views]);

  if (!ready) return <div className="paspor" aria-busy="true" style={{ minHeight: "100vh" }} />;

  const legal = { legalEntityName: data?.legalEntityName ?? null, licenseNumber: data?.licenseNumber ?? null, kupvaCode: data?.kupvaCode ?? null, fraudWarning: data?.fraudWarning ?? null };

  return (
    <div className="paspor" ref={rootRef}>
      <SvgDefs identity={identity} />
      <div className="site">
        <Sky rootRef={rootRef} codes={[...new Set(views.map((view) => view.code))]} />
        <a className="skip" href="#kurs">Langsung ke kurs</a>
        <Header identity={identity} status={status} timeZone={timeZone} />
        {profile.isError ? (
          <div className="wrap" role="alert" style={{ paddingTop: 16 }}>
            <p className="callout">Informasi outlet belum bisa dimuat. Coba muat ulang. <button className="btn" type="button" onClick={() => profile.refetch()}>Muat ulang informasi</button></p>
          </div>
        ) : null}
        <main>
          <RatesSection identity={identity} views={views} dir={dir} onDir={setDir} status={status} phone={phone} timeZone={timeZone} updatedAt={updatedAt}
            loading={rates.isLoading} failed={rates.isError} stale={rates.isRefetchError} onRetry={() => rates.refetch()} onRateEvent={onRateEvent} />
          <CalcSection identity={identity} calc={calc} dir={dir} onDir={setDir} timeZone={timeZone} phone={phone} hasRates={views.length > 0 || rates.isLoading} onRequest={() => setOpenSeq((seq) => seq + 1)} />
          <TicketSection identity={identity} dir={dir} result={calc.result} selectionGone={calc.selectionGone} phone={phone} timeZone={timeZone} openSeq={openSeq} />
          <ShareSection identity={identity} rows={rows} timeZone={timeZone} phone={phone} highlightCode={highlight} />
          <RulesSection identity={identity} rules={data?.moneyRules ?? null} phone={phone} />
          <LocationSection identity={identity} address={data?.address?.trim() || null} mapUrl={data?.mapUrl ?? null} schedule={data?.openingSchedule ?? null} openingHours={data?.openingHours?.trim() || null}
            timeZone={timeZone} status={status} phone={phone} whatsapp={data?.secondaryPhone?.trim() || null} />
          <LegalSection identity={identity} legal={legal} phone={phone} />
          <AnnouncementSection items={announcements.data ?? []} failed={announcements.isError} phone={phone} onRetry={() => announcements.refetch()} />
          <FaqSection identity={identity} items={faqItems(data?.publicFaq, { address: data?.address, openingSchedule: data?.openingSchedule, timezone: timeZone, phone })} phone={phone} />
        </main>
        <Footer identity={identity} legal={legal} address={data?.address?.trim() || null} phone={phone} schedule={data?.openingSchedule ?? null} timeZone={timeZone} />
      </div>
    </div>
  );
}
