import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { rollTo } from "./motion";

/* Nomor seri berlubang di tepi atas setiap spread (rujukan `serialSVG`). */
const GLYPH: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001001010010", "8": "111101111101111", "9": "111101111001111",
  " ": "000000000000000",
};
// Huruf inisial perusahaan: bentuk 3×5 sederhana; huruf tanpa bentuk tampil sebagai kotak penuh.
const LETTERS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "111100100100111", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "111100101101111", H: "101101111101101", I: "111010010010111", J: "001001001101111", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "111101101101101", O: "111101101101111", P: "111101111100100", Q: "111101101111001", R: "111101110101101",
  S: "111100111001111", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
};

function SerialNumber({ text }: { text: string }) {
  const dots: { cx: number; cy: number }[] = [];
  let x = 0;
  for (const char of text) {
    const glyph = GLYPH[char] ?? LETTERS[char] ?? "111111111111111";
    for (let i = 0; i < 15; i += 1) if (glyph[i] === "1") dots.push({ cx: x + (i % 3) * 3 + 1.5, cy: Math.floor(i / 3) * 3 + 1.5 });
    x += char === " " ? 6 : 12;
  }
  return (
    <svg className="serial" viewBox={`0 0 ${x} 15`} style={{ width: `${x * 0.95}px` }} aria-hidden="true">
      {dots.map((dot, index) => <circle key={index} cx={dot.cx} cy={dot.cy} r="1.05" />)}
    </svg>
  );
}

export type Tint = "sky" | "rose" | "mint" | "sand" | "lilac";

export function Spread({ tint, className, serial, initials, children, style }: { tint: Tint; className: string; serial: number; initials: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`spread ${className} guil`} data-tint={tint} style={style}>
      <SerialNumber text={`${initials} ${String(serial).padStart(4, "0")}`} />
      <svg className="wm wm-m" viewBox="0 0 240 160" aria-hidden="true"><use href="#mosque" /></svg>
      <svg className="wm wm-s" viewBox="0 0 100 100" aria-hidden="true"><use href="#logo" /></svg>
      {children}
    </div>
  );
}

/** Tag bagian sebagai cap ("02 | HITUNG"); `data-stamp` diantre oleh `usePageMotion`. */
export const Kick = ({ no, children }: { no: string; children: ReactNode }) => (
  <span className="kick" data-stamp aria-hidden="true"><b>{no}</b>{children}</span>
);

export const PageNo = ({ no }: { no: number }) => <span className="pgno" aria-hidden="true">{String(no).padStart(2, "0")}</span>;

/**
 * Angka bergulir. React tidak mengisi anak elemen ini; `rollTo` yang memegangnya, seperti rujukan.
 * Render pertama tanpa gerak; perubahan sesudahnya bergulir (kecuali `animate` false).
 */
export function Roll({ value, className, as: Tag = "span", animate = true, id, tabIndex }: { value: string; className?: string; as?: "span" | "b" | "p"; animate?: boolean; id?: string; tabIndex?: number }) {
  const ref = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (!ref.current) return;
    rollTo(ref.current, value, mounted.current && animate);
    mounted.current = true;
  }, [value, animate]);
  return <Tag ref={ref as never} className={className} id={id} tabIndex={tabIndex} />;
}
