import { scheduleLines, type OpeningSchedule } from "@shared/openingStatus";
import { telHref, type PublicFaqItem } from "@shared/publicPage";
import { useState } from "react";
import { LiveNote, useCopyNote } from "./ShareSection";
import { Kick, PageNo, Spread } from "./Spread";
import { Icon, Seal } from "./SvgDefs";
import { mrz, mrzPad, type Identity } from "./viewModel";

/**
 * "Daftar Lembaga Berizin" Bank Indonesia — tujuan tautan yang sama dari halaman KUPVA BB & PTD bi.go.id
 * (diperiksa lewat peramban 12 Nov 2026; judul halaman "Daftar Lembaga Berizin").
 */
export const BI_KUPVA_LIST_URL = "https://www.bi.go.id/id/layanan/informasi-perizinan/default.aspx";

type Legal = { legalEntityName: string | null; licenseNumber: string | null; kupvaCode: string | null; fraudWarning: string | null };

/** §7 Resmi & aman. Tanpa logo BI; nomor izin dan kode KUPVA hanya tampil bila diisi di profil. */
export function LegalSection({ identity, legal, phone }: { identity: Identity; legal: Legal; phone: string | null }) {
  const entity = legal.legalEntityName ?? identity.name;
  const arc = `${entity.toUpperCase()} ★ PENUKAR VALUTA ASING BUKAN BANK ★`;
  const licensed = Boolean(legal.licenseNumber);
  return (
    <section className="sec" id="resmi" aria-labelledby="h-legal">
      <div className="wrap">
        <Spread tint="rose" className="legal" serial={7} initials={identity.initials}>
          <div className="pg" style={{ display: "grid", alignContent: "center" }}>
            <svg className="bigseal" data-stamp viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="4" />
              <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <path id="sArc" d="M100 100 m-71 0 a71 71 0 1 1 142 0 a71 71 0 1 1 -142 0" fill="none" />
              <text fontFamily="IBM Plex Mono" fontSize="12.5" fontWeight="700" letterSpacing="3" fill="currentColor">
                <textPath href="#sArc" {...(arc.length > 54 ? { textLength: 436, lengthAdjust: "spacingAndGlyphs" as const } : {})}>{arc}</textPath>
              </text>
              <text x="100" y="98" textAnchor="middle" fontFamily="Archivo" fontWeight="800" fontSize="44" fill="currentColor">{identity.initials}</text>
              {licensed ? <text x="100" y="122" textAnchor="middle" fontFamily="IBM Plex Mono" fontWeight="700" fontSize="11" letterSpacing="2.5" fill="currentColor">BERIZIN</text> : null}
            </svg>
            <PageNo no={12} />
          </div>
          <div className="pg">
            <Kick no="07">Resmi</Kick>
            <h2 id="h-legal">{licensed ? "Berizin Bank Indonesia" : "Periksa izin dan kontak kami"}</h2>
            {licensed ? <p className="lead">{`${entity} berizin Bank Indonesia sebagai penukar valuta asing bukan bank.`}</p> : null}
            <dl className="dl">
              <dt>Badan hukum</dt><dd>{entity}</dd>
              {legal.licenseNumber ? <><dt>Nomor izin</dt><dd className="mono">{legal.licenseNumber}</dd></> : null}
              {legal.kupvaCode ? <><dt>Kode KUPVA</dt><dd className="mono">{legal.kupvaCode}</dd></> : null}
            </dl>
            <p className="note" style={{ marginTop: 16 }}>Periksa nama perusahaan di daftar penukar valas berizin Bank Indonesia.</p>
            <div className="btn-row"><a className="btn" href={BI_KUPVA_LIST_URL} target="_blank" rel="noopener noreferrer"><Icon name="i-ext" />Lihat daftar berizin</a></div>
            <div className="fraud">
              <h3>Periksa nomor yang menghubungi Anda</h3>
              <p>Kami hanya menghubungi Anda dari nomor yang tercantum di halaman ini.</p>
              <p>Kami tidak pernah meminta transfer lewat chat pribadi.</p>
              {legal.fraudWarning ? <p>{legal.fraudWarning}</p> : null}
              <p>{`Jika ada permintaan transfer lewat chat pribadi, jangan transfer.${phone ? ` Telepon ${phone} untuk memastikan.` : ""}`}</p>
              {phone ? <div className="btn-row"><a className="btn" href={telHref(phone)}><Icon name="i-phone" />Telepon outlet</a></div> : null}
            </div>
            <PageNo no={13} />
          </div>
        </Spread>
      </div>
    </section>
  );
}

type Announcement = { id: number; title: string; content: string };

/** §8 Pengumuman: hanya pengumuman terbit dari layar petugas; kosong = tersembunyi, gagal ≠ kosong. */
export function AnnouncementSection({ items, failed, phone, onRetry }: { items: Announcement[]; failed: boolean; phone: string | null; onRetry: () => void }) {
  if (!items.length && !failed) return null;
  return (
    <section className="sec" id="pengumuman" aria-labelledby="h-ann">
      <div className="wrap">
        <Kick no="08">Kabar</Kick>
        <h2 id="h-ann" style={{ marginBottom: 16 }}>Pengumuman outlet</h2>
        {failed && !items.length ? (
          <article className="tele guil" data-tint="sand" role="alert">
            <div className="tele-h"><span>Pengumuman</span></div>
            <div>
              <p style={{ fontSize: 16 }}>{`Pengumuman belum bisa dimuat. Muat ulang${phone ? ` atau telepon ${phone}` : ""} sebelum datang.`}</p>
              <button className="btn" type="button" style={{ marginTop: 10 }} onClick={onRetry}>Muat ulang pengumuman</button>
            </div>
          </article>
        ) : items.map((item) => (
          <article key={item.id} className="tele guil" data-tint="sand" style={{ marginTop: 12 }}>
            <div className="tele-h"><span>Pengumuman</span></div>
            <div>
              <h3 style={{ fontSize: 24 }}>{item.title}</h3>
              <p style={{ marginTop: 6, fontSize: 16, whiteSpace: "pre-line" }}>{item.content}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** §9 Pertanyaan umum (rujukan `#faq`). */
export function FaqSection({ identity, items, phone }: { identity: Identity; items: PublicFaqItem[]; phone: string | null }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (index: number) => setOpen((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  return (
    <section className="sec" id="bantuan" aria-labelledby="h-faq">
      <div className="wrap">
        <Spread tint="lilac" className="faqbox" serial={8} initials={identity.initials}>
          <div className="pg">
            <Kick no="09">Bantuan</Kick>
            <h2 id="h-faq">Pertanyaan umum</h2>
            {phone ? (
              <>
                <p className="lead" style={{ fontSize: 16 }}>{`Untuk menanyakan kurs atau persiapan datang, telepon ${phone}.`}</p>
                <div className="btn-row"><a className="btn" href={telHref(phone)}><Icon name="i-phone" />Telepon outlet</a></div>
              </>
            ) : null}
            <PageNo no={14} />
          </div>
          <div className="pg">
            <div className="faq">
              {items.map((item, index) => (
                <div className="faq-i" key={item.question}>
                  <button className="faq-q" type="button" aria-expanded={open.has(index)} aria-controls={`fa${index}`} id={`fq${index}`} onClick={() => toggle(index)}>
                    <span>{item.question}</span>
                    <span className="faq-ico" aria-hidden="true"><svg><use href="#i-plus" /></svg></span>
                  </button>
                  <div className="faq-a" id={`fa${index}`} role="region" aria-labelledby={`fq${index}`}><div><p>{item.answer}</p></div></div>
                </div>
              ))}
            </div>
            <PageNo no={15} />
          </div>
        </Spread>
      </div>
    </section>
  );
}

type FooterProps = { identity: Identity; legal: Legal; address: string | null; phone: string | null; schedule: OpeningSchedule | null; timeZone: string };

/** Kaki halaman + baris MRZ berisi data asli (nama, kota, jalan, jadwal). */
export function Footer({ identity, legal, address, phone, schedule, timeZone }: FooterProps) {
  const { note, copy } = useCopyNote();
  const firstLine = scheduleLines(schedule, timeZone)[0];
  const mrzSecond = [identity.city, identity.street, firstLine?.replace(/\s*(WIB|WITA|WIT)$/, "").replace(/(\d)\.(\d)/g, "$1$2")].filter(Boolean).map((part) => mrz(part as string)).join("<<");
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div>
            <Seal />
            <p style={{ marginTop: 10 }}><b style={{ fontSize: 20 }}>{identity.name}</b></p>
            {legal.legalEntityName ? <p>{legal.legalEntityName}</p> : null}
            {legal.licenseNumber ? <p>Penukar valuta asing bukan bank berizin Bank Indonesia.</p> : null}
          </div>
          <div>
            {legal.licenseNumber ? <p>{`Nomor izin: ${legal.licenseNumber}`}</p> : null}
            {legal.kupvaCode ? <p>{`Kode KUPVA: ${legal.kupvaCode}`}</p> : null}
            {address ? <p>{address}</p> : null}
          </div>
          <div>
            {phone ? (
              <>
                <p>{`Telepon: ${phone}`}</p>
                <div className="btn-row" style={{ marginTop: 10 }}><button className="btn" type="button" onClick={(event) => copy(phone, event.currentTarget, "Nomor tersalin.", "Nomor belum bisa disalin. Tekan lama nomor di atas, lalu pilih salin.")}><Icon name="i-copy" />Salin nomor</button></div>
                <LiveNote note={note} style={{ color: "#EAD9DD" }} />
              </>
            ) : null}
            <p style={{ marginTop: 8 }}>Kurs di halaman ini perkiraan.</p>
            <p style={{ marginTop: 14 }}><a className="staff" href="/login">Masuk staf</a></p>
          </div>
        </div>
        <div className="fmrz" aria-hidden="true">{mrzPad(`P<IDN${mrz(identity.name)}`, 44)}<br />{mrzPad(mrzSecond, 44)}</div>
      </div>
    </footer>
  );
}
