import { zoneAbbreviation, type OpeningStatusText } from "@shared/openingStatus";
import { BULAN, HARI, p2, useNow, wallClock } from "./clock";
import { StatusChip } from "./StatusLine";
import { Icon, Seal } from "./SvgDefs";
import type { Identity } from "./viewModel";

/** Kepala halaman (rujukan `header.top`): segel + nama, jangkar, jam berdetak, chip Buka/Tutup, Mode TV. */
export function Header({ identity, status, timeZone }: { identity: Identity; status: OpeningStatusText; timeZone: string }) {
  return (
    <header className="top">
      <div className="wrap top-in">
        <a className="brand" href="#kurs" aria-label={`${identity.name}, ke kurs hari ini`}>
          <Seal id="hdrSeal" />
          <span className="brand-name"><b>{identity.name}</b>{identity.city ? <small>{identity.city}</small> : null}</span>
        </a>
        <nav className="nav" aria-label="Navigasi utama">
          <a href="#kurs">Kurs</a><a href="#hitung">Hitung</a><a href="#lokasi">Lokasi</a><a href="#bantuan">Bantuan</a>
        </nav>
        <div className="status">
          <Clock timeZone={timeZone} />
          <StatusChip status={status} />
          <span className="status-text">{status.detail}</span>
          <a className="btn-tv" href="/papan"><Icon name="i-tv" width={16} height={16} />Mode TV</a>
        </div>
      </div>
    </header>
  );
}

/** Satu-satunya bagian halaman yang berdetak tiap detik. */
function Clock({ timeZone }: { timeZone: string }) {
  const clock = wallClock(useNow(), timeZone);
  return (
    <span className="clock" aria-label="Waktu sekarang">
      {`${HARI[clock.day]}, ${clock.date} ${BULAN[clock.mon].slice(0, 3)} · ${p2(clock.h)}.${p2(clock.m)}`}<i>{`.${p2(clock.s)}`}</i>{` ${zoneAbbreviation(timeZone)}`}
    </span>
  );
}
