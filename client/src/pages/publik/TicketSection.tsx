import { trpc } from "@/lib/trpc";
import { zoneAbbreviation } from "@shared/openingStatus";
import { TRPCClientError } from "@trpc/client";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { copyWithStamp, loud, loudRemaining, reducedMotion, shake, slamFrames, stampSvg, thud, wait } from "./motion";
import { Kick, PageNo, Roll, Spread } from "./Spread";
import { Icon } from "./SvgDefs";
import type { Calculation } from "./useCalculation";
import { barcodeBars, dirName, rp, type Dir, type Identity } from "./viewModel";

const ZONE_OFFSET: Record<string, string> = { "Asia/Jakarta": "+07:00", "Asia/Makassar": "+08:00", "Asia/Jayapura": "+09:00" };

type Props = { identity: Identity; dir: Dir; result: Calculation | null; selectionGone: boolean; phone: string | null; timeZone: string; openSeq: number };
type Errors = Partial<Record<"name" | "num" | "time" | "ok" | "req", string>>;

/** §3 Minta konfirmasi kurs: tiket mendatar yang menulis `service_requests` sungguhan (rujukan `#konfirmasi`). */
export function TicketSection({ identity, dir, result, selectionGone, phone, timeZone, openSeq }: Props) {
  const create = trpc.serviceRequests.create.useMutation();
  const [via, setVia] = useState<"wa" | "tel">("wa");
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [time, setTime] = useState("");
  const [ok, setOk] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stubRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const printed = useRef(false);
  const stubHeight = useRef(0);
  const jual = dir === "jual";
  const code = result?.view.code ?? "VALAS";
  const callSuffix = phone ? ` telepon ${phone}` : " hubungi outlet";

  const printIn = () => {
    const form = formRef.current;
    if (!form || reducedMotion()) return;
    const remaining = loudRemaining();
    if (remaining > 0) { setTimeout(printIn, remaining + 40); return; }
    loud(800);
    form.animate([
      { transform: "translateY(-18px) rotate(-.5deg)", opacity: 0.5 },
      { transform: "translateY(4px) rotate(.25deg)", opacity: 1, offset: 0.62 },
      { transform: "translateY(-1.5px) rotate(-.1deg)", offset: 0.82 },
      { transform: "none", opacity: 1 },
    ], { duration: 760, easing: "cubic-bezier(.23,1,.32,1)" });
  };

  // Tiket "tercetak" sekali saat pertama terlihat.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !printed.current) { printed.current = true; observer.disconnect(); printIn(); } }, { threshold: 0.35 });
    observer.observe(feed);
    return () => observer.disconnect();
  }, []);

  // Tombol "Minta konfirmasi kurs" di kalkulator: gulir ke tiket, cetak, fokus ke nama.
  useEffect(() => {
    if (!openSeq) return;
    printed.current = true;
    const section = document.getElementById("konfirmasi");
    const go = () => { printIn(); nameRef.current?.focus({ preventScroll: true }); };
    if (reducedMotion()) { section?.scrollIntoView(); go(); return; }
    let done = false;
    const once = () => { if (!done) { done = true; go(); } };
    addEventListener("scrollend", once, { once: true });
    const timer = setTimeout(once, 900);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => { clearTimeout(timer); removeEventListener("scrollend", once); };
  }, [openSeq]);

  useLayoutEffect(() => {
    const stub = stubRef.current;
    if (!requestNumber || !stub) return;
    stub.getAnimations().forEach((animation) => animation.cancel());
    stub.querySelector<HTMLElement>(".rcpt")?.focus({ preventScroll: true });
    if (reducedMotion()) return;
    const after = stub.offsetHeight;
    if (Math.abs(after - stubHeight.current) > 2) stub.animate([{ height: `${stubHeight.current}px`, overflow: "hidden" }, { height: `${after}px`, overflow: "hidden" }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
    formRef.current?.classList.remove("torn");
    stub.animate([{ transform: "translateY(-16px)", opacity: 0.35 }, { transform: "none", opacity: 1 }], { duration: 340, easing: "cubic-bezier(.23,1,.32,1)" });
  }, [requestNumber]);

  const accepted = async (number: string) => {
    const stub = stubRef.current;
    const stamp = stampRef.current;
    const form = formRef.current;
    if (!stub || !stamp || !form) { setRequestNumber(number); return; }
    stamp.innerHTML = stampSvg("DITERIMA");
    if (reducedMotion()) { stamp.classList.add("on", "inked"); setRequestNumber(number); return; }
    const phoneView = innerWidth <= 640;
    loud(1900);
    form.classList.add("torn");
    await stub.animate([
      { transform: "none", opacity: 1 },
      { transform: phoneView ? "translate(-2px,3px) rotate(-1.5deg)" : "translate(3px,2px) rotate(2deg)", opacity: 1, offset: 0.22 },
      { transform: phoneView ? "translate(-14px,60px) rotate(-7deg)" : "translate(24px,70px) rotate(9deg)", opacity: 0.85, offset: 0.6 },
      { transform: phoneView ? "translate(-26px,130px) rotate(-11deg)" : "translate(46px,150px) rotate(12deg)", opacity: 0 },
    ], { duration: 600, easing: "cubic-bezier(.55,.05,.7,.4)", fill: "forwards" }).finished.catch(() => {});
    stamp.classList.add("on");
    stamp.animate(slamFrames(-9), { duration: 440, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" }).finished.then(() => stamp.classList.add("inked")).catch(() => {});
    setTimeout(() => thud(form.querySelector(".tkt-main")), 240);
    await wait(460);
    stubHeight.current = stub.offsetHeight;
    setRequestNumber(number);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending || requestNumber) return;
    const digits = num.replace(/\D/g, "");
    const at = time ? new Date(`${time}:00${ZONE_OFFSET[timeZone] ?? "+07:00"}`) : null;
    const next: Errors = {
      name: !name.trim() ? "Nama belum diisi. Isi nama Anda agar petugas tahu siapa yang dihubungi." : name.trim().length < 3 || name.trim().length > 200 ? "Nama terlalu pendek atau panjang. Sesuaikan menjadi 3 sampai 200 karakter." : "",
      num: !num.trim() ? "Nomor belum diisi. Isi nomor yang bisa dihubungi." : !/^[+\d\s()-]+$/.test(num.trim()) || digits.length < 8 || digits.length > 15 ? "Nomor belum bisa dipakai. Periksa nomor dan kode negaranya." : "",
      time: at && Number.isNaN(at.getTime()) ? "Waktu datang belum terbaca. Pilih ulang tanggal dan jam, atau kosongkan kolom ini." : at && at.getTime() < Date.now() ? "Waktu datang sudah lewat. Pilih waktu yang akan datang, atau kosongkan kolom ini." : "",
      ok: ok ? "" : "Persetujuan dihubungi belum dipilih. Centang persetujuan jika Anda ingin meminta konfirmasi kurs.",
      req: result && !selectionGone ? "" : `Kurs pilihan Anda sudah tidak tersedia. Hitung ulang atau${callSuffix}.`,
    };
    setErrors(next);
    const form = formRef.current;
    const bad = (["name", "num", "time", "ok"] as const).filter((key) => next[key]);
    if (bad.length) {
      bad.forEach((key) => shake(form?.querySelector(key === "ok" ? ".check" : `#r${{ name: "Name", num: "Num", time: "Time" }[key]}`) ?? null));
      form?.querySelector<HTMLElement>(`[aria-invalid="true"]`)?.focus();
      return;
    }
    if (next.req || !result) { shake(form?.querySelector(".tchips") ?? null); return; }
    try {
      const created = await create.mutateAsync({
        requesterName: name.trim(), contactChannel: via === "wa" ? "WHATSAPP" : "PHONE", contactValue: num.trim(), currencyId: result.view.currencyId,
        // "Anda jual" = perusahaan membeli (BUY), sama dengan layar petugas.
        operation: jual ? "BUY" : "SELL", foreignAmount: result.amount, preferredServiceAt: at ?? undefined, contactConsent: true,
      });
      await accepted(created.requestNumber);
    } catch (error) {
      const answered = error instanceof TRPCClientError && Boolean(error.data);
      setErrors({ req: answered ? `Permintaan belum tersimpan. Coba lagi atau${callSuffix}.` : `Hasil permintaan belum bisa dipastikan.${phone ? ` Telepon ${phone} sebelum Anda mencoba lagi.` : " Hubungi outlet sebelum Anda mencoba lagi."}` });
    }
  };

  const copyRequest = async (button: HTMLButtonElement) => {
    if (!requestNumber) return;
    const done = await copyWithStamp(requestNumber, button);
    setCopyNote(done ? { ok: true, text: "Nomor permintaan tersalin." } : { ok: false, text: "Nomor belum bisa disalin. Catat nomor permintaan yang tertera." });
    setTimeout(() => setCopyNote(null), 4000);
  };

  const bars = barcodeBars(result ? `${result.total}${result.rate}${result.view.code.length}` : "000000");
  const locked = create.isPending || Boolean(requestNumber);
  const field = (key: keyof Errors) => ({ "aria-invalid": Boolean(errors[key]) });

  return (
    <section className="sec" id="konfirmasi" aria-labelledby="h-konf">
      <div className="wrap">
        <Spread tint="lilac" className="konf" serial={3} initials={identity.initials}>
          <div className="pg">
            <div className="konf-head">
              <div><Kick no="03">Konfirmasi</Kick><h2 id="h-konf">Minta konfirmasi kurs</h2></div>
              <div>
                <p className="lead" style={{ marginTop: 0 }}>Petugas kami akan menghubungi Anda untuk memastikan kursnya.</p>
                <p className="warnline">Ini bukan pemesanan atau transaksi. Mengisi formulir tidak mengunci kurs.</p>
              </div>
            </div>
            <div className="feed" ref={feedRef}>
              <form className="tkt" ref={formRef} noValidate aria-labelledby="h-konf" onSubmit={submit}>
                <div className="tkt-main">
                  <div className="tkt-top"><span>Pas naik · Minta konfirmasi kurs</span><span aria-hidden="true">{identity.initials}{identity.city ? ` · ${identity.city}` : ""}</span></div>
                  <div className="tkt-body">
                    <div className="tchips" aria-live="polite">
                      <span className="tchip">{result ? `${dirName(dir)} ${result.amountText} ${result.view.code}` : "Pilih mata uang dan pecahan, lalu isi jumlah untuk menghitung."}</span>
                      {result ? <span className="tchip">{`Pecahan ${result.view.den}`}</span> : null}
                      <span className="tchip"><span>{jual ? "Perkiraan Anda terima:" : "Perkiraan Anda bayar:"}</span> {result ? <Roll as="b" className="num" value={rp(result.total)} /> : <b className="num">–</b>}</span>
                      {!requestNumber ? <button className="linkbtn" type="button" onClick={() => { document.getElementById("hitung")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" }); document.getElementById("fAmt")?.focus({ preventScroll: true }); }}>Ubah perhitungan</button> : null}
                    </div>
                    <p className="err" role="alert">{errors.req}</p>
                    <fieldset className="tfs" disabled={locked}>
                      <legend className="sr">Data untuk dihubungi</legend>
                      <div className="tfields">
                        <div className="field">
                          <label htmlFor="rName">Nama Anda</label>
                          <input className="ctl" id="rName" ref={nameRef} autoComplete="name" placeholder="Isi nama Anda" aria-describedby="eName" value={name} onChange={(event) => setName(event.target.value)} {...field("name")} />
                          <p className="err" id="eName">{errors.name}</p>
                        </div>
                        <div className="field">
                          <span className="flabel" id="lVia">Hubungi Anda lewat</span>
                          <div className="radios seg" role="radiogroup" aria-labelledby="lVia">
                            <label className="radio"><input type="radio" name="via" value="wa" checked={via === "wa"} onChange={() => setVia("wa")} /><span>WhatsApp</span></label>
                            <label className="radio"><input type="radio" name="via" value="tel" checked={via === "tel"} onChange={() => setVia("tel")} /><span>Telepon</span></label>
                          </div>
                        </div>
                        <div className="field">
                          <label htmlFor="rNum">{via === "wa" ? "Nomor WhatsApp Anda" : "Nomor telepon Anda"}</label>
                          <input className="ctl num" id="rNum" type="tel" autoComplete="tel" placeholder={via === "wa" ? "Isi nomor WhatsApp Anda" : "Isi nomor telepon Anda"} aria-describedby="hNum eNum" value={num} onChange={(event) => setNum(event.target.value)} {...field("num")} />
                          <p className="help" id="hNum">Isi nomor yang bisa dipakai petugas untuk menghubungi Anda.</p>
                          <p className="err" id="eNum">{errors.num}</p>
                        </div>
                        <div className="field">
                          <label htmlFor="rTime">Rencana waktu datang (opsional)</label>
                          <input className="ctl" id="rTime" type="datetime-local" aria-describedby="hTime eTime" value={time} onChange={(event) => setTime(event.target.value)} {...field("time")} />
                          <p className="help" id="hTime">{`Waktu memakai ${zoneAbbreviation(timeZone)}. Petugas akan memastikan rencana kedatangan Anda.`}</p>
                          <p className="err" id="eTime">{errors.time}</p>
                        </div>
                      </div>
                      <label className="check"><input type="checkbox" id="rOk" aria-describedby="eOk" checked={ok} onChange={(event) => setOk(event.target.checked)} {...field("ok")} /><span>Saya setuju dihubungi petugas untuk membahas permintaan ini.</span></label>
                      <p className="err" id="eOk">{errors.ok}</p>
                      <p className="warnline">Jangan isi nomor KTP, nomor rekening, atau data pembayaran di formulir ini.</p>
                    </fieldset>
                  </div>
                  <span className="tkt-stamp" ref={stampRef} aria-hidden="true" />
                </div>
                <div className="tkt-stub" ref={stubRef}>
                  {requestNumber ? (
                    <div className="rcpt" tabIndex={-1}>
                      <small className="sk" style={{ marginTop: 0 }}>{identity.name}</small>
                      <h3>Permintaan diterima</h3>
                      <small className="sk">Nomor permintaan</small><Roll as="p" className="req-no" value={requestNumber} />
                      <p style={{ marginTop: 10 }}>Simpan nomor ini. Petugas kami akan menghubungi Anda di jam buka.</p>
                      <p className="note" style={{ marginTop: 4 }}>Kurs dan waktu datang belum dikonfirmasi.</p>
                      <button className="btn" type="button" onClick={(event) => copyRequest(event.currentTarget)}><Icon name="i-copy" />Salin nomor permintaan</button>
                      <p className={`live${copyNote ? (copyNote.ok ? " ok" : " bad") : ""}`} aria-live="polite">{copyNote?.text}</p>
                    </div>
                  ) : (
                    <div id="stubPre">
                      <small className="sk">Rute</small><b className="troute mono">{jual ? `${code} → IDR` : `IDR → ${code}`}</b>
                      <small className="sk">Perkiraan</small>{result ? <Roll as="b" className="sv num" value={rp(result.total)} /> : <b className="sv num">–</b>}
                      <svg className="bc" viewBox={`0 0 ${bars.width} 50`} preserveAspectRatio="none" aria-hidden="true"><g fill="currentColor">{bars.bars.map((bar) => <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="50" />)}</g></svg>
                      <button className="btn pri tbtn" type="submit" disabled={create.isPending}>{create.isPending ? "Memproses permintaan…" : "Minta konfirmasi kurs"}</button>
                    </div>
                  )}
                </div>
              </form>
            </div>
            <PageNo no={5} />
          </div>
        </Spread>
      </div>
    </section>
  );
}
