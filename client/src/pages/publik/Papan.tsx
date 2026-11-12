import { usePublicProfile } from "@/lib/publicProfile";
import { trpc } from "@/lib/trpc";
import { latestPublicRateEffectiveAt } from "@shared/publicRates";
import { zoneAbbreviation } from "@shared/openingStatus";
import { DEFAULT_OPERATIONAL_TIMEZONE } from "@shared/regulatoryActionQueue";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { longDate, p2, shortTime, useNow, wallClock } from "./clock";
import { landStamp, reducedMotion, thud } from "./motion";
import { Roll } from "./Spread";
import { Seal, SvgDefs } from "./SvgDefs";
import { usePublicDocument } from "./usePublicDocument";
import { changeLabel, fmt, identityFrom, toRateViews, type RateView } from "./viewModel";
import "./paspor.css";
import "./paspor-app.css";

export const PAPAN_ROWS_PER_PAGE = 6;
export const PAPAN_TURN_MS = 12_000;
/** Layar TV menyegarkan kurs lebih sering daripada halaman biasa supaya aktivasi staf cepat terlihat di outlet. */
export const PAPAN_REFRESH_MS = 30_000;

function PapanRow({ view, hit }: { view: RateView; hit: boolean }) {
  const info = changeLabel(view.chg.jual);
  const den = view.den === "Semua pecahan" ? "Semua" : view.den;
  return (
    <div className={`pp-row${hit ? " hit" : ""}`} data-id={view.id}>
      <span className="pp-glow" />
      <div className="pp-cur"><b>{view.code}</b><span>{view.name}</span></div>
      <div className="pp-pec">{den}<small>{view.unitText}</small></div>
      <Roll className="pp-v j num" value={fmt(view.jual)} />
      <Roll className="pp-v b num" value={fmt(view.beli)} />
      <span className="pp-chg" data-k={info.k}><svg aria-hidden="true"><use href={`#i-${info.k}`} /></svg>{info.t}</span>
    </div>
  );
}

/** Jam berdetak tiap detik tanpa merender ulang seluruh papan. */
function PapanClock({ timeZone }: { timeZone: string }) {
  const clock = wallClock(useNow(), timeZone);
  return <div className="pp-clock"><small>{`Waktu ${zoneAbbreviation(timeZone)}`}</small><b>{`${p2(clock.h)}.${p2(clock.m)}.${p2(clock.s)}`}</b><span>{longDate(clock)}</span></div>;
}

/** `/papan`: papan kurs layar penuh untuk TV outlet (rujukan `#papan`). Membaca kurs aktif; tidak menulis apa pun. */
export default function Papan() {
  const profile = usePublicProfile();
  const rates = trpc.rates.activeRates.useQuery(undefined, { refetchInterval: PAPAN_REFRESH_MS });
  const data = profile.data;
  const timeZone = data?.timezone ?? DEFAULT_OPERATIONAL_TIMEZONE;
  const identity = identityFrom({ tradingName: data?.tradingName, address: data?.address });
  const views = useMemo(() => toRateViews(rates.data ?? []), [rates.data]);
  const [shown, setShown] = useState(views);
  const [page, setPage] = useState(0);
  const [hitId, setHitId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pages = Math.max(1, Math.ceil(shown.length / PAPAN_ROWS_PER_PAGE));
  const updatedAt = latestPublicRateEffectiveAt(rates.data ?? []);
  usePublicDocument(identity, "papan");

  const turnPage = async (to: number) => {
    const el = pageRef.current;
    if (el && !reducedMotion()) await el.animate([{ transform: "none", opacity: 1 }, { transform: "rotateY(-82deg)", opacity: 0.2 }], { duration: 380, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }).finished.catch(() => {});
    setPage(to);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (el && !reducedMotion()) await el.animate([{ transform: "rotateY(70deg)", opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards" }).finished.catch(() => {});
    el?.getAnimations().forEach((animation) => animation.cancel());
  };

  // Halaman bergilir tiap 12 detik selama tidak ada cap yang sedang mendarat.
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && pages > 1 && !busy.current) void turnPage((page + 1) % pages); }, PAPAN_TURN_MS);
    return () => clearInterval(timer);
  }, [page, pages]);

  // Kurs berubah → balik ke halamannya, cap "KURS BARU", lalu angka bergulir (rujukan `papanHit`).
  useEffect(() => {
    const before = new Map(shown.map((view) => [view.id, view]));
    const changed = views.find((view) => { const old = before.get(view.id); return old && (old.jual !== view.jual || old.beli !== view.beli); });
    if (!shown.length || !changed) { setShown(views); return; }
    busy.current = true;
    (async () => {
      const target = Math.floor(views.findIndex((view) => view.id === changed.id) / PAPAN_ROWS_PER_PAGE);
      if (target !== page) await turnPage(target);
      const row = pageRef.current?.querySelector<HTMLElement>(`[data-id="${changed.id}"]`);
      const body = bodyRef.current;
      if (row && body) {
        const rowRect = row.getBoundingClientRect(); const bodyRect = body.getBoundingClientRect(); const width = rowRect.width * 0.16;
        setHitId(null);
        await landStamp(body, { x: rowRect.width * 0.4, y: rowRect.top - bodyRect.top + rowRect.height / 2 }, "KURS BARU", { w: width, h: width * 0.34, rot: -6, hold: 2200 });
        thud(row);
      }
      setShown(views);
      setHitId(changed.id);
      setTimeout(() => { busy.current = false; }, 2600);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dipicu data baru saja
  }, [views]);

  // Baris halaman baru "membalik" masuk.
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    pageRef.current?.querySelectorAll(".pp-row").forEach((row, index) => row.animate([{ transform: "rotateX(-80deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, delay: index * 60, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" }));
  }, [shown.length > 0]);

  const list = shown.slice(page * PAPAN_ROWS_PER_PAGE, page * PAPAN_ROWS_PER_PAGE + PAPAN_ROWS_PER_PAGE);
  const updated = updatedAt ? wallClock(updatedAt, timeZone) : null;
  const empty = rates.isError && !shown.length
    ? { title: "Kurs belum bisa dimuat", text: "Muat ulang atau tanyakan kepada petugas outlet.", retry: true }
    : !shown.length && !rates.isLoading ? { title: "Belum ada kurs", text: "Tanyakan kurs kepada petugas outlet.", retry: false } : null;

  return (
    <div className="paspor tv">
      <SvgDefs identity={identity} />
      <section className="papan" aria-label="Papan kurs">
        <div className="pp">
          <a className="pp-back" href="/">Buka halaman utama</a>
          <div className="pp-h">
            <div className="pp-brand"><Seal /><div><b>{identity.name}</b><span>Kurs hari ini</span></div></div>
            <PapanClock timeZone={timeZone} />
          </div>
          <div className="pp-cols"><span>Mata uang</span><span>Pecahan</span><span>Anda jual valas</span><span>Anda beli valas</span><span /></div>
          <div className="pp-body" ref={bodyRef}>
            {rates.isLoading && !shown.length ? <div className="pp-empty"><b>Memuat kurs…</b></div> : null}
            {empty ? (
              <div className="pp-empty" role={empty.retry ? "alert" : undefined}>
                <b>{empty.title}</b><span>{empty.text}</span>
                {empty.retry ? <button className="btn" type="button" onClick={() => rates.refetch()}>Muat ulang kurs</button> : null}
              </div>
            ) : (
              <div className="pp-page" ref={pageRef}>{list.map((view) => <PapanRow key={view.id} view={view} hit={hitId === view.id} />)}</div>
            )}
          </div>
          <div className="pp-f">
            <p className="pp-note">{rates.isRefetchError ? "Kurs terbaru belum bisa dimuat. Tanyakan kurs kepada petugas outlet." : "Kurs perkiraan. Tanyakan petugas untuk kurs pasti."}</p>
            <p className="pp-meta">
              <span>{updated ? `Kurs diperbarui ${longDate(updated)}, ${shortTime(updated, timeZone)}` : ""}</span><br />
              <span>{`Halaman ${page + 1} dari ${pages}`}</span>
              <span className="pp-dots">{Array.from({ length: pages }, (_, index) => <i key={index} className={index === page ? "on" : ""} />)}</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
