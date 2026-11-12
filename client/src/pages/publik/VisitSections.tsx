import { scheduleLines, type OpeningSchedule, type OpeningStatusText } from "@shared/openingStatus";
import { hasMoneyRules, telHref, type MoneyRules } from "@shared/publicPage";
import { LiveNote, useCopyNote } from "./ShareSection";
import { Kick, PageNo, Spread } from "./Spread";
import { StatusLine } from "./StatusLine";
import { Icon } from "./SvgDefs";
import { whatsappHref, type Identity } from "./viewModel";

/** §5 Pecahan dan kondisi uang. Tidak tampil sama sekali bila pemilik belum mengisi ketentuannya (spec teks §4). */
export function RulesSection({ identity, rules, phone }: { identity: Identity; rules: MoneyRules | null; phone: string | null }) {
  if (!rules || !hasMoneyRules(rules)) return null;
  const items = [rules.denominations, rules.condition, rules.series].filter((item): item is string => Boolean(item?.trim()));
  return (
    <section className="sec" id="ketentuan" aria-labelledby="h-rules">
      <div className="wrap">
        <Spread tint="sand" className="rules" serial={5} initials={identity.initials}>
          <div className="pg">
            <Kick no="05">Uang</Kick>
            <h2 id="h-rules">Pecahan dan kondisi uang</h2>
            <p className="lead">Beda pecahan bisa beda kurs. Pastikan pecahan uang Anda dengan petugas sebelum transaksi.</p>
            <PageNo no={8} />
          </div>
          <div className="pg">
            <ol className="cond">{items.map((item) => <li key={item}><p>{item}</p></li>)}</ol>
            {phone ? (
              <div className="callout" style={{ borderColor: "var(--ink-2)" }}>
                <p>{`Belum yakin dengan kondisi uang Anda? Telepon ${phone} sebelum datang.`}</p>
                <a className="btn" href={telHref(phone)}><Icon name="i-phone" />Telepon outlet</a>
              </div>
            ) : null}
            <PageNo no={9} />
          </div>
        </Spread>
      </div>
    </section>
  );
}

type LocationProps = {
  identity: Identity; address: string | null; mapUrl: string | null; schedule: OpeningSchedule | null; openingHours: string | null;
  timeZone: string; status: OpeningStatusText; phone: string | null; whatsapp: string | null;
};

function CopyNumber({ value, label }: { value: string; label: string }) {
  const { note, copy } = useCopyNote();
  return (
    <>
      <button className="btn" type="button" aria-label={`Salin nomor ${label}`} onClick={(event) => copy(value, event.currentTarget, "Nomor tersalin.", "Nomor belum bisa disalin. Tekan lama nomor di atas, lalu pilih salin.")}><Icon name="i-copy" />Salin nomor</button>
      <LiveNote note={note} />
    </>
  );
}

/** §6 Datang ke outlet (rujukan `#lokasi`). Semua isi dari Profil Perusahaan; yang kosong tidak ditampilkan. */
export function LocationSection({ identity, address, mapUrl, schedule, openingHours, timeZone, status, phone, whatsapp }: LocationProps) {
  const lines = scheduleLines(schedule, timeZone);
  const wa = whatsappHref(whatsapp);
  return (
    <section className="sec" id="lokasi" aria-labelledby="h-loc">
      <div className="wrap">
        <Spread tint="sky" className="loc" serial={6} initials={identity.initials}>
          <div className="pg">
            <Kick no="06">Lokasi</Kick>
            <h2 id="h-loc">Datang ke outlet</h2>
            {address ? (
              <div className="kv">
                <span className="k">Alamat</span>
                <span className="v">{address}</span>
                {mapUrl ? <div className="btn-row"><a className="btn pri" href={mapUrl} target="_blank" rel="noopener noreferrer"><Icon name="i-map" />Buka di peta</a></div> : null}
              </div>
            ) : null}
            <div className="kv">
              <span className="k">Jam buka</span>
              <span className="v">{lines.length ? lines.join(" · ") : status.detail}</span>
              {openingHours ? <span className="note">{openingHours}</span> : null}
              {lines.length ? <StatusLine status={status} style={{ marginTop: 6 }} /> : null}
            </div>
            {phone ? (
              <div className="kv">
                <span className="k">Telepon</span>
                <span className="v num">{phone}</span>
                <div className="btn-row"><a className="btn" href={telHref(phone)}><Icon name="i-phone" />Telepon outlet</a><CopyNumber value={phone} label="telepon" /></div>
              </div>
            ) : null}
            {whatsapp && wa ? (
              <div className="kv">
                <span className="k">WhatsApp</span>
                <span className="v num">{whatsapp}</span>
                <div className="btn-row"><a className="btn" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="i-chat" />Chat di WhatsApp</a><CopyNumber value={whatsapp} label="WhatsApp" /></div>
              </div>
            ) : null}
            <PageNo no={10} />
          </div>
          <div className="pg">
            {address ? <MapPicture identity={identity} /> : null}
            <h3 style={{ marginTop: address ? 24 : 0 }}>Yang perlu Anda bawa</h3>
            <div className="bring">
              <div className="bring-i"><Icon name="i-id" /><div><b>Identitas</b><p>Bawa KTP atau paspor Anda.</p></div></div>
              <div className="bring-i"><Icon name="i-pen" /><div><b>Pembelian sampai USD 10.000</b><p>Jika total pembelian valas Anda sampai USD 10.000 atau setaranya dalam sebulan, Anda menandatangani pernyataan. Pernyataan ini menyebut pembelian bulan itu belum melewati batas tersebut.</p></div></div>
              <div className="bring-i"><Icon name="i-doc" /><div><b>Pembelian di atas USD 10.000</b><p>Jika total pembelian valas Anda melebihi USD 10.000 atau setaranya dalam sebulan, bawa dokumen pendukung dan NPWP.</p></div></div>
              <div className="bring-i"><Icon name="i-cal" /><div><p>Batas dihitung per orang per bulan. Aturan berlaku sejak 1 Juli 2026.</p>{phone ? <p style={{ marginTop: 4 }}>{`Untuk memastikan dokumen yang perlu dibawa, telepon ${phone}.`}</p> : null}</div></div>
            </div>
            <PageNo no={11} />
          </div>
        </Spread>
      </div>
    </section>
  );
}

/** Peta gambar (bukan iframe; rencana bagian §5). Nama jalan dan inisial dari profil. */
function MapPicture({ identity }: { identity: Identity }) {
  return (
    <div className="map">
      <svg viewBox="0 0 480 300" role="img" aria-label={`Lokasi ${identity.name}${identity.city ? ` di ${identity.city}` : ""}`}>
        <rect width="480" height="300" fill="#E3E8F0" />
        <g fill="#D3DAE5"><rect x="20" y="20" width="120" height="70" rx="6" /><rect x="170" y="20" width="90" height="70" rx="6" /><rect x="300" y="18" width="160" height="80" rx="6" /><rect x="20" y="182" width="150" height="96" rx="6" /><rect x="300" y="190" width="70" height="90" rx="6" /><rect x="392" y="190" width="70" height="90" rx="6" /></g>
        <path d="M-10 250 C 80 230 120 270 210 255 S 360 220 490 245" fill="none" stroke="#BFC8D8" strokeWidth="10" />
        <path d="M-10 140 H490" stroke="#fff" strokeWidth="22" />
        <path d="M-10 140 H490" stroke="#C9A657" strokeWidth="2" strokeDasharray="10 10" />
        <path d="M282 -10 V310" stroke="#fff" strokeWidth="16" />
        <path d="M150 -10 L 196 310" stroke="#fff" strokeWidth="10" />
        {identity.street ? <text x="30" y="128" fontFamily="IBM Plex Mono" fontSize="12" fontWeight="600" fill="#47506B" letterSpacing="1.5">{identity.street.toUpperCase()}</text> : null}
        <g transform="translate(236 140)">
          <circle className="pin-pulse" r="14" fill="#7A1C2C" opacity=".5" />
          <path d="M0 0 C -14 -16 -16 -24 -16 -32 a16 16 0 0 1 32 0 c0 8 -2 16 -16 32z" fill="#7A1C2C" />
          <text x="0" y="-27" textAnchor="middle" fontFamily="Archivo" fontWeight="800" fontSize="13" fill="#fff">{identity.initials}</text>
        </g>
        <g transform="translate(400 30)" fill="none" stroke="#47506B" strokeWidth="1.5"><circle r="16" /><path d="M0 -12 L4 0 L0 12 L-4 0z" fill="#47506B" /><text y="-20" textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono" fill="#47506B" stroke="none">U</text></g>
      </svg>
    </div>
  );
}
