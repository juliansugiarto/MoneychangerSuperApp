import { buildRateShareText, type PublicRateRow } from "@shared/publicRates";
import { useEffect, useState } from "react";
import { copyWithStamp } from "./motion";
import { Kick, PageNo, Spread } from "./Spread";
import { Icon } from "./SvgDefs";
import type { Identity } from "./viewModel";

type Note = { ok: boolean; text: string } | null;

/** Pesan salin dengan catatan sukses/gagal yang hilang sendiri sesudah 4 detik (rujukan `copyText`). */
export function useCopyNote() {
  const [note, setNote] = useState<Note>(null);
  useEffect(() => { if (!note) return; const timer = setTimeout(() => setNote(null), 4000); return () => clearTimeout(timer); }, [note]);
  const copy = async (text: string, button: HTMLElement, ok: string, fail: string) => setNote((await copyWithStamp(text, button)) ? { ok: true, text: ok } : { ok: false, text: fail });
  return { note, copy };
}

export const LiveNote = ({ note, style }: { note: Note; style?: React.CSSProperties }) => (
  <p className={`live${note ? (note.ok ? " ok" : " bad") : ""}`} aria-live="polite" style={style}>{note?.text}</p>
);

/** §4 Bagikan kurs hari ini (rujukan `#bagikan`). `highlightCode` = valuta yang baru berubah, disorot sebentar. */
export function ShareSection({ identity, rows, timeZone, phone, highlightCode }: { identity: Identity; rows: PublicRateRow[]; timeZone: string; phone: string | null; highlightCode: { code: string; seq: number } | null }) {
  const url = typeof location === "undefined" ? "" : location.origin;
  const message = buildRateShareText(rows, { tradingName: identity.name, url, timeZone });
  const lines = message?.split("\n") ?? [];
  const { note, copy } = useCopyNote();
  const [fade, setFade] = useState(false);
  useEffect(() => {
    if (!highlightCode) return;
    setFade(false);
    const timer = setTimeout(() => setFade(true), 1600);
    return () => clearTimeout(timer);
  }, [highlightCode]);
  const highlighted = (line: string, index: number) => Boolean(highlightCode) && (index === 0 || line.startsWith(`${highlightCode?.code} `));

  return (
    <section className="sec" id="bagikan" aria-labelledby="h-share">
      <div className="wrap">
        <Spread tint="mint" className="share" serial={4} initials={identity.initials}>
          <div className="pg">
            <Kick no="04">Bagikan</Kick>
            <h2 id="h-share">Bagikan kurs hari ini</h2>
            <p className="lead">{message ? "Pesan berisi kurs utama hari ini dan tautan halaman ini." : phone ? `Belum ada kurs untuk dibagikan. Telepon ${phone} untuk menanyakan kurs.` : "Belum ada kurs untuk dibagikan."}</p>
            <div className="btn-row">
              {message ? <a className="btn pri" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><Icon name="i-chat" />Bagikan ke WhatsApp</a> : null}
              {message ? <button className="btn" type="button" onClick={(event) => copy(message, event.currentTarget, "Pesan tersalin.", "Pesan belum bisa disalin. Coba lagi atau salin tautan halaman ini.")}><Icon name="i-copy" />Salin pesan</button> : null}
              <button className="btn" type="button" onClick={(event) => copy(url, event.currentTarget, "Tautan tersalin.", "Tautan belum bisa disalin. Tekan lama tautan, lalu pilih salin.")}><Icon name="i-copy" />Salin tautan</button>
            </div>
            <LiveNote note={note} />
            <p className="link-line">{url}</p>
            <PageNo no={6} />
          </div>
          <div className="pg">
            <div className="post">
              <span className="post-stamp" aria-hidden="true"><svg><use href="#logo" /></svg></span>
              <svg className="postmark" viewBox="0 0 90 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2" /><text x="22" y="25" fontSize="8" textAnchor="middle" fontFamily="IBM Plex Mono" fill="currentColor" fontWeight="700">CGK</text><path d="M44 12q6-5 12 0t12 0t12 0M44 22q6-5 12 0t12 0t12 0M44 32q6-5 12 0t12 0t12 0" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              <p className="msg-h">Pratinjau pesan</p>
              <p className="msg">
                {lines.length ? lines.map((line, index) => (
                  <span key={index}>
                    {highlighted(line, index) ? <span className="hl" style={fade ? { backgroundColor: "transparent" } : undefined}>{line}</span> : line}
                    {index < lines.length - 1 ? "\n" : null}
                  </span>
                )) : "–"}
              </p>
            </div>
            <PageNo no={7} />
          </div>
        </Spread>
      </div>
    </section>
  );
}
