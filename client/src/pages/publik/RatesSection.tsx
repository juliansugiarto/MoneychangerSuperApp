import { telHref } from "@shared/publicPage";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BULAN, longDate, p2, shortTime, wallClock } from "./clock";
import { finePointer, landStamp, loud, reducedMotion, restartClass, thud } from "./motion";
import { Kick, PageNo, Roll, Spread } from "./Spread";
import { StatusLine } from "./StatusLine";
import { Icon } from "./SvgDefs";
import { Toggle } from "./Toggle";
import { changeLabel, dirName, fmt, mrz, mrzPad, otherDir, type Dir, type Identity, type RateView } from "./viewModel";
import { zoneAbbreviation, type OpeningStatusText } from "@shared/openingStatus";

type Props = {
  identity: Identity; views: RateView[]; dir: Dir; onDir: (dir: Dir) => void; status: OpeningStatusText; phone: string | null;
  timeZone: string; updatedAt: Date | null; loading: boolean; failed: boolean; stale: boolean; onRetry: () => void;
  /** Dipanggil sesudah cap "KURS BARU" mendarat untuk baris yang berubah. */
  onRateEvent: (id: string) => void;
};

export const ChangeTag = ({ view, dir, flash }: { view: RateView; dir: Dir; flash?: boolean }) => {
  const info = changeLabel(view.chg[dir]);
  return <span className={`chg${flash ? " flash" : ""}`} data-k={info.k}><svg aria-hidden="true"><use href={`#i-${info.k}`} /></svg>{info.t}</span>;
};

const callSuffix = (phone: string | null) => (phone ? ` atau telepon ${phone}` : "");

/** §1 Kurs hari ini: halaman data paspor (rujukan `#kurs`). */
export function RatesSection({ identity, views, dir, onDir, status, phone, timeZone, updatedAt, loading, failed, stale, onRetry, onRateEvent }: Props) {
  const [shown, setShown] = useState(views);
  const [tagged, setTagged] = useState<Set<string>>(new Set());
  const [flashed, setFlashed] = useState<Set<string>>(new Set());
  const ptRef = useRef<HTMLDivElement>(null);
  const tblRef = useRef<HTMLDivElement>(null);
  const mRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  const holoRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const firstDir = useRef(true);

  // Peristiwa: kurs berubah → cap mendarat di baris, baru kemudian angkanya bergulir (rujukan `changeRate`).
  useEffect(() => {
    const before = new Map(shown.map((view) => [view.id, view]));
    const changed = views.filter((view) => { const old = before.get(view.id); return old && (old.jual !== view.jual || old.beli !== view.beli); });
    if (!shown.length || !changed.length) { setShown(views); return; }
    let cancelled = false;
    (async () => {
      const id = changed[0].id;
      const phoneView = innerWidth < 960;
      const host = phoneView ? mRef.current : tblRef.current;
      const row = host?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (host && row && !reducedMotion()) {
        loud(2000);
        const hostRect = host.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        await landStamp(host, { x: hostRect.width * (phoneView ? 0.5 : 0.56), y: rowRect.top - hostRect.top + rowRect.height / 2 }, "KURS BARU", { w: phoneView ? 150 : 180, h: phoneView ? 50 : 60, rot: -7, hold: 1600 });
        thud(row);
        restartClass(row, "rowflash");
      }
      if (cancelled) return;
      setShown(views);
      setTagged((current) => new Set([...current, ...changed.map((view) => view.id)]));
      setFlashed(new Set(changed.map((view) => view.id)));
      changed.forEach((view) => onRateEvent(view.id));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dipicu data baru saja; `shown` adalah keadaan sebelumnya
  }, [views]);

  const placeBand = (animate: boolean) => {
    const band = bandRef.current;
    const wrap = tblRef.current;
    const th = wrap?.querySelector<HTMLElement>(`th.h-${dir}`);
    if (!band || !wrap || !th || !wrap.offsetParent) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = th.getBoundingClientRect();
    if (!band.dataset.w) { band.dataset.w = String(rect.width); band.style.width = `${rect.width}px`; }
    band.style.top = `${rect.top - wrapRect.top}px`;
    if (!animate) band.style.transition = "none";
    band.style.transform = `translateX(${rect.left - wrapRect.left}px) scaleX(${rect.width / Number(band.dataset.w)})`;
    if (!animate) { void band.offsetWidth; band.style.transition = ""; }
  };

  useLayoutEffect(() => {
    if (firstDir.current) { firstDir.current = false; placeBand(false); return; }
    restartClass(ptRef.current, "press");
    mRef.current?.querySelectorAll("li").forEach((li) => restartClass(li, "swap"));
    placeBand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  useEffect(() => {
    let frame = 0;
    const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => placeBand(false)); };
    onResize();
    document.fonts?.ready.then(onResize);
    addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.length, dir]);

  // Laminasi hologram: mengikuti penunjuk (desktop) atau gulir (sentuh), di bawah teks.
  useEffect(() => {
    const pt = ptRef.current;
    const holo = holoRef.current;
    if (!pt || !holo || reducedMotion()) return;
    let frame = 0; let hx = 0; let hy = 0; let rect: DOMRect | null = null; let onScreen = true;
    const set = () => { frame = 0; holo.style.transform = `translate3d(${hx}px,${hy}px,0)`; };
    const queue = () => { if (!frame) frame = requestAnimationFrame(set); };
    if (finePointer()) {
      const enter = () => { rect = pt.getBoundingClientRect(); };
      const move = (event: PointerEvent) => { if (!rect) return; hx = ((event.clientX - rect.left) / rect.width - 0.5) * -160; hy = ((event.clientY - rect.top) / rect.height - 0.5) * -110; queue(); };
      const leave = () => { hx = 0; hy = 0; queue(); };
      pt.addEventListener("pointerenter", enter); pt.addEventListener("pointermove", move); pt.addEventListener("pointerleave", leave);
      return () => { pt.removeEventListener("pointerenter", enter); pt.removeEventListener("pointermove", move); pt.removeEventListener("pointerleave", leave); cancelAnimationFrame(frame); };
    }
    const observer = new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; });
    observer.observe(pt);
    const scroll = () => { if (!onScreen) return; hx = Math.sin(scrollY / 260) * 90; hy = Math.cos(scrollY / 340) * 60; queue(); };
    addEventListener("scroll", scroll, { passive: true });
    return () => { observer.disconnect(); removeEventListener("scroll", scroll); cancelAnimationFrame(frame); };
  }, []);

  const clock = updatedAt ? wallClock(updatedAt, timeZone) : null;
  const updText = clock ? `Diperbarui ${longDate(clock)}, ${shortTime(clock, timeZone)}` : null;
  useEffect(() => { if (updText) restartClass(stampRef.current, "hit"); }, [updText]);
  const mrzRates = shown.map((view) => `${view.code}${view.mden === "semua" ? "" : view.mden.replace(/\D/g, "")}<${Math.round(view.jual)}<${Math.round(view.beli)}`).join("<<");
  const nowClock = wallClock(new Date(), timeZone);

  return (
    <section className="sec" id="kurs" aria-labelledby="h-kurs">
      <div className="wrap">
        <Spread tint="sky" className="hero" serial={1} initials={identity.initials}>
          <div className="pg pa">
            <Kick no="01">Kurs</Kick>
            <h1 id="h-kurs">Kurs hari ini</h1>
            <div className="upd">
              {clock ? (
                <span className="dstamp" ref={stampRef} aria-hidden="true"><small>DIPERBARUI</small><b>{`${clock.date} ${BULAN[clock.mon].slice(0, 3).toUpperCase()} ${clock.yr}`}</b><span>{shortTime(clock, timeZone)}</span></span>
              ) : null}
              <div><p className="upd-text">{updText ?? (loading ? "Memuat kurs…" : "Belum ada kurs")}</p></div>
            </div>
            <p className="lead">Anda mau menukar valas? Pilih jual atau beli untuk melihat kurs yang sesuai.</p>
            <Toggle dir={dir} onChange={onDir} labelId="tgl1" hint />
            <StatusLine status={status} />
          </div>
          <div className="pg pb">
            <div className="notes" style={{ marginTop: 0 }}>
              <p>Kurs ini perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi.</p>
              <p>Beda pecahan bisa beda kurs, misalnya USD 100 dan pecahan kecil.</p>
              <p>Perubahan dibanding kurs sebelumnya.</p>
            </div>
            {phone ? (
              <div className="callout">
                <p>Mau tukar dalam jumlah besar? Telepon dulu supaya pecahannya kami siapkan.</p>
                <a className="btn pri" href={telHref(phone)}><Icon name="i-phone" />Telepon outlet</a>
              </div>
            ) : null}
            <PageNo no={1} />
          </div>
          <div className="pg pt" ref={ptRef}>
            <span className="holo" ref={holoRef} aria-hidden="true" />
            {failed && !shown.length ? (
              <RatesNotice text={`Kurs belum bisa dimuat. Coba muat ulang${callSuffix(phone)}.`} onRetry={onRetry} />
            ) : !shown.length ? (
              loading ? <p className="upd-text" aria-busy="true">Memuat kurs…</p> : <RatesNotice title="Belum ada kurs" text={phone ? `Telepon ${phone} untuk menanyakan kurs dan pecahan yang tersedia.` : "Tanyakan kurs dan pecahan yang tersedia kepada petugas outlet."} />
            ) : (
              <>
                {stale ? <RatesNotice text={`Kurs terbaru belum bisa dimuat. Muat ulang${callSuffix(phone)} untuk memastikan kurs.`} onRetry={onRetry} /> : null}
                <div className="tbl-wrap" ref={tblRef}>
                  <span className="band" ref={bandRef} aria-hidden="true" />
                  <table className="rates" data-dir={dir}>
                    <caption>Kurs valas menurut pecahan</caption>
                    <thead><tr>
                      <th scope="col">Mata uang</th>
                      <th scope="col" className="h-pec">Pecahan</th>
                      <th scope="col" className="h-jual">Anda jual<small>Rupiah yang Anda terima</small></th>
                      <th scope="col" className="h-beli">Anda beli<small>Rupiah yang Anda bayar</small></th>
                      <th scope="col" className="h-chg">Perubahan</th>
                    </tr></thead>
                    <tbody>
                      {shown.map((view, index) => (
                        <tr key={view.id} data-id={view.id} style={{ ["--i" as string]: index }}>
                          <td><div className="cur"><span className="code">{view.code}</span><span className="cur-t"><b>{view.name}</b><small>{view.unitText}</small><span className="tagslot">{tagged.has(view.id) ? <span className="newtag">KURS BARU</span> : null}</span></span></div></td>
                          <td className="c-pec">{view.den}</td>
                          <td className="c-jual"><Roll className="val num" value={fmt(view.jual)} /></td>
                          <td className="c-beli"><Roll className="val num" value={fmt(view.beli)} /></td>
                          <td className="c-chg"><ChangeTag view={view} dir={dir} flash={flashed.has(view.id)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mwrap" ref={mRef}>
                  <p className="mhead"><span>Mata uang</span><span><b>{dirName(dir)}</b> · {dir === "jual" ? "Rupiah yang Anda terima" : "Rupiah yang Anda bayar"}</span></p>
                  <ul className="mrates" aria-label="Kurs valas menurut pecahan">
                    {shown.map((view, index) => (
                      <li key={view.id} data-id={view.id} style={{ ["--i" as string]: index }}>
                        <span className="code">{view.code}</span>
                        <span className="mname"><b>{view.name}</b><span className="mden"> · {view.mden}</span></span>
                        <Roll className="mbig num" value={fmt(view[dir])} />
                        <span className="mchg"><ChangeTag view={view} dir={dir} flash={flashed.has(view.id)} />{tagged.has(view.id) ? <span className="newtag">KURS BARU</span> : null}</span>
                        <span className="msmall"><span className="mlab">{dirName(otherDir(dir))}</span> <Roll className="mo num" value={fmt(view[otherDir(dir)])} animate={false} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <PageNo no={2} />
          </div>
          <div className="mrz" aria-hidden="true">
            <div>{mrzPad(`P<IDN${mrz(identity.name)}<<${identity.city ? mrz(identity.city) : ""}`, 64)}</div>
            <div>{`${mrz(status.chip)}<<${p2(nowClock.h)}${p2(nowClock.m)}${zoneAbbreviation(timeZone)}<<${mrzRates}<<KURS<PERKIRAAN<<<<<<<<`}</div>
          </div>
        </Spread>
      </div>
    </section>
  );
}

function RatesNotice({ title, text, onRetry }: { title?: string; text: string; onRetry?: () => void }) {
  return (
    <div className="callout" role={onRetry ? "alert" : undefined}>
      {title ? <p>{title}</p> : null}
      <p style={title ? { fontWeight: 400 } : undefined}>{text}</p>
      {onRetry ? <button className="btn" type="button" onClick={onRetry}>Muat ulang kurs</button> : null}
    </div>
  );
}
