import { useEffect, useRef } from "react";
import { reducedMotion } from "./motion";

/** Rute rujukan, asal CGK. Bandara = valuta di papan: hanya valuta yang sedang punya kurs yang disinggahi. */
const AIRPORTS: [string, string][] = [["JED", "SAR"], ["KUL", "MYR"], ["SIN", "SGD"], ["HKG", "HKD"], ["PKX", "CNY"], ["NRT", "JPY"], ["SYD", "AUD"], ["CDG", "EUR"], ["LHR", "GBP"]];
const FINAL: [string, string] = ["JFK", "USD"];

export function routeStops(codes: readonly string[]): { stops: [string, string][]; last: [string, string] } {
  const present = new Set(codes);
  const stops = present.size ? AIRPORTS.filter(([, code]) => present.has(code)) : AIRPORTS;
  return { stops, last: !present.size || present.has("USD") ? FINAL : stops.pop() ?? FINAL };
}

type Flight = { ready: boolean; ys: Float32Array; xs: Float32Array; ls: Float32Array; total: number; wps: { el: HTMLElement; l: number; on: boolean }[] };

/**
 * Awan (paralaks) + rute pesawat yang digambar mengikuti gulir (rujukan `buildRoute`/`updateSky`). Titik rute
 * dihitung analitik dari segmen — bukan `getPointAtLength` berulang — supaya pembangunan ulang tetap murah
 * (aturan kinerja DESIGN.md). Di layar sempit rute menjadi rel tipis di tepi kiri.
 */
export function Sky({ rootRef, codes }: { rootRef: React.RefObject<HTMLDivElement | null>; codes: string[] }) {
  const routeRef = useRef<HTMLDivElement>(null);
  const cloudRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const codeKey = codes.join(",");

  useEffect(() => {
    const root = rootRef.current;
    const route = routeRef.current;
    if (!root || !route) return;
    const svg = route.querySelector("svg")!;
    const base = svg.querySelector<SVGPathElement>("#routeBase")!;
    const flown = svg.querySelector<SVGPathElement>("#routeFlown")!;
    const mask = svg.querySelector<SVGPathElement>("#routeMask")!;
    const plane = route.querySelector<HTMLElement>(".plane2")!;
    const rates = [0.22, 0.4, 0.62];
    const flight: Flight = { ready: false, ys: new Float32Array(1), xs: new Float32Array(1), ls: new Float32Array(1), total: 0, wps: [] };
    const { stops, last } = routeStops(codeKey ? codeKey.split(",") : []);
    let frame = 0; let rebuildTimer = 0; let skyW = 0; let skyH = 0;

    const buildClouds = () => {
      const height = innerHeight;
      cloudRefs.forEach((ref, layer) => {
        const count = [5, 4, 3][layer];
        let html = "";
        for (let i = 0; i < count; i += 1) {
          const x = ((i * 37 + layer * 23) % 100) - 10;
          const y = (((i * 211 + layer * 97) % 100) / 100) * height;
          const w = 180 + ((i * 53 + layer * 41) % 160);
          const one = `left:${x}%;width:${w}px;height:${w * 0.42}px;--dur:${38 + i * 7}s`;
          html += `<i style="${one};top:${y}px"></i><i style="${one};top:${y + height}px"></i>`;
        }
        if (ref.current) ref.current.innerHTML = html;
      });
    };

    const indexAtY = (y: number) => {
      const ys = flight.ys; let lo = 0; let hi = ys.length - 1;
      if (y <= ys[0]) return 0;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid] < y) lo = mid + 1; else hi = mid; }
      return lo;
    };

    const update = () => {
      frame = 0;
      const sy = scrollY;
      if (!reducedMotion()) cloudRefs.forEach((ref, layer) => { if (ref.current) ref.current.style.transform = `translate3d(0,${-((sy * rates[layer]) % innerHeight)}px,0)`; });
      if (!flight.ready) return;
      const i = reducedMotion() ? 0 : indexAtY(sy + innerHeight * 0.5);
      const a = Math.max(0, i - 3); const b = Math.min(flight.ys.length - 1, i + 3);
      const angle = (Math.atan2(flight.ys[b] - flight.ys[a], flight.xs[b] - flight.xs[a]) * 180) / Math.PI;
      plane.style.transform = `translate(${flight.xs[i]}px,${flight.ys[i]}px) rotate(${angle}deg)`;
      const length = reducedMotion() ? flight.total : flight.ls[i];
      mask.style.strokeDashoffset = String(flight.total - length);
      flight.wps.forEach((wp) => { const on = length >= wp.l - 1; if (on !== wp.on) { wp.on = on; wp.el.classList.toggle("on", on); } });
    };

    const buildRoute = () => {
      const sections = [...root.querySelectorAll<HTMLElement>("main > .sec")];
      const firstSpread = root.querySelector<HTMLElement>("#kurs .spread");
      const footer = root.querySelector<HTMLElement>("footer");
      if (!sections.length || !firstSpread || !footer || !route.offsetParent) return;
      const sy = scrollY; const width = document.documentElement.clientWidth;
      const top = (el: Element) => el.getBoundingClientRect().top + sy;
      const spreadLeft = firstSpread.getBoundingClientRect().left;
      const rail = spreadLeft < 74;
      const height = top(footer);
      route.classList.toggle("rail", rail);
      route.style.height = `${height}px`;
      svg.setAttribute("width", String(width)); svg.setAttribute("height", String(height)); svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const lx = rail ? 8 : spreadLeft / 2; const rx = rail ? 8 : width - spreadLeft / 2; const X = (side: number) => (side ? rx : lx);
      let y = top(sections[0]) + 40; let side = 0; let d = `M${lx} ${y}`;
      const pts: [number, number][] = [[lx, y]];
      const curve = (p0: number[], p1: number[], p2: number[], p3: number[]) => {
        for (let k = 1; k <= 24; k += 1) {
          const t = k / 24; const u = 1 - t;
          pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
        }
      };
      const runs: number[] = [];
      for (let i = 1; i < sections.length; i += 1) {
        const g = top(sections[i]) - 10; const cx = X(side); const nx = X(1 - side);
        runs.push((y + (rail ? g : g - 80)) / 2);
        if (rail) { d += ` L${cx} ${g}`; pts.push([cx, g]); y = g; continue; }
        d += ` L${cx} ${g - 80} C${cx} ${g} ${nx} ${g} ${nx} ${g + 80}`;
        pts.push([cx, g - 80]); curve([cx, g - 80], [cx, g], [nx, g], [nx, g + 80]);
        side = 1 - side; y = g + 80;
      }
      const end = sections[sections.length - 1].getBoundingClientRect().bottom + sy - 40;
      runs.push((y + end) / 2);
      d += ` L${X(side)} ${end}`; pts.push([X(side), end]);
      [base, flown, mask].forEach((path) => path.setAttribute("d", d));
      const total = base.getTotalLength();
      const cum = [0];
      for (let k = 1; k < pts.length; k += 1) cum[k] = cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const own = cum[cum.length - 1] || 1; const N = Math.max(1, Math.ceil(own / 6));
      const ys = new Float32Array(N + 1); const xs = new Float32Array(N + 1); const ls = new Float32Array(N + 1);
      for (let i = 0, k = 1; i <= N; i += 1) {
        const l = (own * i) / N;
        while (k < cum.length - 1 && cum[k] < l) k += 1;
        const segment = cum[k] - cum[k - 1] || 1; const t = Math.min(1, Math.max(0, (l - cum[k - 1]) / segment));
        xs[i] = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t; ys[i] = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
        ls[i] = (l * total) / own;
      }
      Object.assign(flight, { ys, xs, ls, total, ready: true });
      mask.style.strokeDasharray = `${total} ${total}`;
      const marks: [string, string, number][] = [["CGK", "Jakarta", 0], ...runs.slice(0, stops.length).map((ry, i): [string, string, number] => [stops[i][0], stops[i][1], indexAtY(ry)]), [last[0], last[1], N]];
      route.querySelectorAll(".wp").forEach((el) => el.remove());
      flight.wps = marks.map(([code, sub, i]) => {
        const el = document.createElement("span");
        el.className = "wp";
        el.innerHTML = `<span><b>${code}</b><br><small>${sub}</small></span>`;
        route.appendChild(el);
        el.style.transform = `translate(${xs[i] - el.offsetWidth / 2}px,${ys[i] - 5}px)`;
        return { el, l: ls[i], on: false };
      });
      update();
    };

    const tick = () => { if (!frame) frame = requestAnimationFrame(update); };
    const rebuild = () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(() => {
        if (innerWidth !== skyW || innerHeight !== skyH) { skyW = innerWidth; skyH = innerHeight; buildClouds(); }
        buildRoute();
      }, 160);
    };
    addEventListener("scroll", tick, { passive: true });
    const observer = new ResizeObserver(rebuild);
    observer.observe(root);
    document.fonts?.ready.then(rebuild);
    return () => { removeEventListener("scroll", tick); observer.disconnect(); clearTimeout(rebuildTimer); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, codeKey]);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <div className="cl cl1" ref={cloudRefs[0]} /><div className="cl cl2" ref={cloudRefs[1]} /><div className="cl cl3" ref={cloudRefs[2]} />
      </div>
      <div className="route" ref={routeRef} aria-hidden="true">
        <svg>
          <defs><mask id="flownMask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><path id="routeMask" fill="none" stroke="#fff" strokeWidth="12" /></mask></defs>
          <path id="routeBase" /><path id="routeFlown" mask="url(#flownMask)" />
        </svg>
        <span className="plane2"><svg viewBox="0 0 24 24"><path d="M2.5 13.5 21 8.6c.9-.2 1.6.9.9 1.6l-1 .9-6.6 2.5-3.4 6.4-2.2.6 1.3-5.2-4.6 1.7-1.6 2-1.5.4.7-3.2z" fill="currentColor" transform="rotate(14 12 12)" /></svg></span>
      </div>
    </>
  );
}
