import { useEffect, useLayoutEffect, useRef } from "react";
import { longDate, shortTime, wallClock } from "./clock";
import { reducedMotion, restartClass } from "./motion";
import { Kick, PageNo, Roll, Spread } from "./Spread";
import { Toggle } from "./Toggle";
import type { CalculationState } from "./useCalculation";
import { dirName, rp, type Dir, type Identity } from "./viewModel";

type Props = { identity: Identity; calc: CalculationState; dir: Dir; onDir: (dir: Dir) => void; timeZone: string; phone: string | null; hasRates: boolean; onRequest: () => void };

/** §2 Hitung tukar = pas naik yang hidup (rujukan `#hitung`). */
export function CalcSection({ identity, calc, dir, onDir, timeZone, phone, hasRates, onRequest }: Props) {
  const jual = dir === "jual";
  const routeRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const firstDir = useRef(true);
  const result = calc.result;
  const code = calc.code || "VALAS";
  const [from, to] = jual ? [code, "IDR"] : ["IDR", code];

  useLayoutEffect(() => {
    if (firstDir.current) { firstDir.current = false; return; }
    restartClass(routeRef.current, "flip");
  }, [dir]);

  // Lebar garis rute untuk pesawat kecil (rujukan `lw`).
  useEffect(() => {
    const set = () => { if (lineRef.current) lineRef.current.style.setProperty("--lw", `${lineRef.current.clientWidth}px`); };
    set();
    addEventListener("resize", set);
    return () => removeEventListener("resize", set);
  }, []);

  const recalc = () => {
    calc.recalculate();
    const total = totalRef.current?.querySelector<HTMLElement>(".total");
    if (!reducedMotion()) restartClass(total ?? null, "bump");
    total?.focus?.();
  };
  const updated = result ? wallClock(result.view.effectiveAt, timeZone) : null;

  return (
    <section className="sec" id="hitung" aria-labelledby="h-hitung">
      <div className="wrap">
        <Spread tint="rose" className="calc" serial={2} initials={identity.initials}>
          <div className="pg">
            <Kick no="02">Hitung</Kick>
            <h2 id="h-hitung">Hitung tukar Anda</h2>
            <p className="lead">Pilih mata uang, pecahan, dan jumlah yang ingin Anda tukar.</p>
            {!hasRates ? <p className="callout" style={{ fontWeight: 600 }}>{phone ? `Belum ada kurs untuk menghitung. Telepon ${phone} untuk menanyakan kurs.` : "Belum ada kurs untuk menghitung."}</p> : null}
            <form noValidate onSubmit={(event) => { event.preventDefault(); calc.submitStrict(); }}>
              <Toggle dir={dir} onChange={onDir} labelId="tgl2" />
              <div className="two">
                <div className="field">
                  <label htmlFor="fCur">Mata uang</label>
                  <select className="ctl" id="fCur" aria-describedby="eCur" aria-invalid={Boolean(calc.errors.cur)} value={calc.code} onChange={(event) => calc.chooseCode(event.target.value)}>
                    <option value="">Pilih mata uang</option>
                    {calc.codes.map(([value, name]) => <option key={value} value={value}>{`${value} · ${name}`}</option>)}
                  </select>
                  <p className="err" id="eCur">{calc.errors.cur}</p>
                </div>
                <div className="field">
                  <label htmlFor="fDen">Pecahan uang</label>
                  <select className="ctl" id="fDen" aria-describedby="hDen eDen" aria-invalid={Boolean(calc.errors.den)} value={calc.viewId} onChange={(event) => calc.chooseView(event.target.value)}>
                    <option value="">Pilih pecahan</option>
                    {calc.denominations.map((view) => <option key={view.id} value={view.id}>{`${view.den}${view.unit !== 1 ? ` (kurs per ${view.unit} ${view.code})` : ""}`}</option>)}
                  </select>
                  <p className="err" id="eDen">{calc.selectionGone ? `Kurs untuk pilihan ini belum tersedia. Pilih pecahan lain${phone ? ` atau telepon ${phone}` : ""}.` : calc.errors.den}</p>
                </div>
              </div>
              <p className="help" id="hDen">Pecahan uang bisa punya kurs berbeda. Pilih sesuai uang yang Anda jual atau beli.</p>
              <div className="field">
                <label htmlFor="fAmt">{jual ? "Jumlah valas yang Anda jual" : "Jumlah valas yang Anda beli"}</label>
                <input className="ctl num" id="fAmt" inputMode="decimal" autoComplete="off" placeholder="Contoh: 500" value={calc.amountRaw} aria-invalid={Boolean(calc.errors.amt)} aria-describedby="hAmt eAmt" onChange={(event) => calc.changeAmount(event.target.value)} />
                <p className="help" id="hAmt">{calc.code ? `Isi jumlah dalam ${calc.code}, bukan rupiah atau jumlah lembar.` : ""}</p>
                <p className="err" id="eAmt">{calc.errors.amt}</p>
              </div>
            </form>
            <PageNo no={3} />
          </div>
          <div className="pg">
            <article className="bpass" aria-label="Perkiraan tukar">
              <div>
                <div className="bp-main">
                  <div className="bp-top"><span>Perkiraan tukar</span><span>{dirName(dir)}</span></div>
                  <div className="bp-route" ref={routeRef} aria-hidden="true">
                    <span className="rt"><small>Dari</small><b>{from}</b></span>
                    <span className="rt-line" ref={lineRef}><svg className="plane" viewBox="0 0 24 24"><path d="M2.5 13.5 21 8.6c.9-.2 1.6.9.9 1.6l-1 .9-6.6 2.5-3.4 6.4-2.2.6 1.3-5.2-4.6 1.7-1.6 2-1.5.4.7-3.2z" fill="currentColor" /></svg></span>
                    <span className="rt" style={{ textAlign: "right" }}><small>Ke</small><b>{to}</b></span>
                  </div>
                  <div className="bp-res" aria-live="polite" ref={totalRef}>
                    <p className="res-label">{jual ? "Perkiraan rupiah yang Anda terima" : "Perkiraan rupiah yang Anda bayar"}</p>
                    {result ? <Roll className="total num" value={rp(result.total)} tabIndex={-1} /> : <span className="total num">Rp –</span>}
                    <p className="res-sum">{result
                      ? (jual ? `Anda jual ${result.amountText} ${result.view.code}. Perkiraan Anda menerima ${rp(result.total)}.` : `Anda beli ${result.amountText} ${result.view.code}. Perkiraan Anda membayar ${rp(result.total)}.`)
                      : "Pilih mata uang dan pecahan, lalu isi jumlah untuk menghitung."}</p>
                    {calc.rateChanged ? (
                      <div className="chgbox">
                        <p>Kurs sudah berubah. Hitung ulang untuk melihat perkiraan terbaru.</p>
                        <button className="btn ink" type="button" onClick={recalc}>Hitung ulang</button>
                      </div>
                    ) : null}
                  </div>
                  <dl className="bp-f">
                    <div><dt>{result ? `Kurs per ${result.view.unit} ${result.view.code}` : `Kurs per 1 ${code}`}</dt><dd>{result ? rp(result.rate) : "–"}</dd></div>
                    <div><dt>Outlet</dt><dd>{identity.city ?? identity.name}</dd></div>
                    <div><dt>Diperbarui</dt><dd>{updated ? `${longDate(updated)}, ${shortTime(updated, timeZone)}` : "–"}</dd></div>
                  </dl>
                  <div className="bp-notes">
                    <p>Total dibulatkan ke atas dalam kelipatan Rp 100.</p>
                    <p>Hasil ini perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi.</p>
                  </div>
                  <div className="bp-act"><button className="btn pri" type="button" onClick={onRequest}>Minta konfirmasi kurs</button></div>
                </div>
              </div>
            </article>
            <PageNo no={4} />
          </div>
        </Spread>
      </div>
    </section>
  );
}
