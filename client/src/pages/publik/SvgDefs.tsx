import type { Identity } from "./viewModel";

/** Teks melingkar yang lebih panjang dari rujukan dipadatkan agar tetap satu putaran. */
const fit = (text: string, referenceLength: number, pathLength: number) =>
  text.length > referenceLength ? { textLength: pathLength, lengthAdjust: "spacingAndGlyphs" as const } : {};

/** Sprite SVG rujukan: filter tinta, segel logo, ikon, dan siluet masjid. Logo memakai nama/kota dari profil. */
export function SvgDefs({ identity }: { identity: Identity }) {
  const arc = `${[identity.name, identity.city].filter(Boolean).join(" · ")} · KURS VALAS ·`.toUpperCase();
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={7} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="t" />
          <feDisplacementMap in="t" in2="n" scale={1.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <symbol id="logo" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <g className="ring">
            <path id="lgArc" d="M50 50 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0" fill="none" />
            <text fontFamily="IBM Plex Mono,monospace" fontSize="8.2" fontWeight="600" letterSpacing="2.2" fill="currentColor">
              <textPath href="#lgArc" {...fit(arc, 43, 246)}>{arc}</textPath>
            </text>
          </g>
          <text x="50" y="61" textAnchor="middle" fontFamily="Archivo,sans-serif" fontWeight="800" fontSize="31" fill="currentColor" letterSpacing="-1">{identity.initials}</text>
        </symbol>
        <symbol id="i-up" viewBox="0 0 10 10"><path d="M5 1 9.5 9h-9z" fill="currentColor" /></symbol>
        <symbol id="i-down" viewBox="0 0 10 10"><path d="M5 9 .5 1h9z" fill="currentColor" /></symbol>
        <symbol id="i-flat" viewBox="0 0 10 10"><rect x="1" y="4" width="8" height="2" fill="currentColor" /></symbol>
        <symbol id="i-none" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" /></symbol>
        <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.6 3.5h3l1.4 4.2-2 1.3a12 12 0 0 0 6 6l1.3-2 4.2 1.4v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" strokeWidth="1.8" /></symbol>
        <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 19.5 5.3 15A8 8 0 1 1 9 18.7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
        <symbol id="i-map" viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" /></symbol>
        <symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="9" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3" stroke="currentColor" strokeWidth="1.6" fill="none" /></symbol>
        <symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
        <symbol id="i-pen" viewBox="0 0 24 24"><path d="M4 20h5L20 9l-5-5L4 15z M13 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" /></symbol>
        <symbol id="i-plus" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></symbol>
        <symbol id="i-tv" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" /></symbol>
        <symbol id="mosque" viewBox="0 0 240 160"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M6 152H234" /><path d="M64 152V98H176V152" /><path d="M50 98 120 66 190 98Z" /><path d="M70 70 120 46 170 70Z" /><path d="M98 46a22 22 0 0 1 44 0" /><path d="M120 24V12" /><circle cx="120" cy="9" r="3" /><path d="M84 152v-26a8 8 0 0 1 16 0v26M112 152v-30a8 8 0 0 1 16 0v30M140 152v-26a8 8 0 0 1 16 0v26" /><path d="M22 152V52h14v100M204 152V52h14v100" /><path d="M19 52h20l-10-22zM201 52h20l-10-22z" /><path d="M22 80h14M22 110h14M204 80h14M204 110h14" /><path d="M29 30v-8M211 30v-8" /></g></symbol>
      </defs>
    </svg>
  );
}

export const Icon = ({ name, className, width, height }: { name: string; className?: string; width?: number; height?: number }) => (
  <svg aria-hidden="true" className={className} width={width} height={height}><use href={`#${name}`} /></svg>
);

/** Logo segel, dipakai di kepala, sampul, papan, dan kaki. */
export const Seal = ({ className = "seal", id }: { className?: string; id?: string }) => (
  <span className={className} id={id}><svg aria-hidden="true"><use href="#logo" /></svg></span>
);
