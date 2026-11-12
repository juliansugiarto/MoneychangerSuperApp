/**
 * Gerak halaman publik, dipindahkan apa adanya dari skrip rujukan `rujukan-paspor-v3.html` (disetujui pemilik
 * 12 Nov 2026). Aturan DESIGN.md: satu gerak keras pada satu waktu (`loud`), isi terlihat saat diam, cap ber-filter
 * di lapisan sendiri tanpa `mix-blend-mode` selama bergerak (kelas `inked` sesudah mendarat).
 */
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => typeof matchMedia === "function" && matchMedia("(hover:hover) and (pointer:fine)").matches;
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ---------- angka bergulir ---------- */
const STACK = `<span class="rs">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => `<span>${digit}</span>`).join("")}</span>`;
const isDigit = (char: string) => char >= "0" && char <= "9";
const escapeChar = (char: string) => (char === " " ? "&nbsp;" : char === "<" ? "&lt;" : char === "&" ? "&amp;" : char);

/** Teks pembaca layar di `.sr`, angka tampak di `.roll` (aria-hidden). */
export function rollTo(el: HTMLElement, text: string, animate = true) {
  let sr = el.querySelector<HTMLElement>(":scope > .sr");
  let visual = el.querySelector<HTMLElement>(":scope > .roll");
  if (!sr || !visual) {
    el.innerHTML = '<span class="sr"></span><span class="roll" aria-hidden="true"></span>';
    sr = el.firstChild as HTMLElement;
    visual = el.lastChild as HTMLElement;
  }
  sr.textContent = text;
  const previous = visual.dataset.v ?? "";
  const same = previous.length === text.length && [...previous].every((char, index) => isDigit(char) === isDigit(text[index]) && (isDigit(char) || char === text[index]));
  const moving = animate && !reducedMotion();
  if (!same) {
    visual.innerHTML = [...text].map((char) => (isDigit(char) ? `<span class="rd">${STACK}</span>` : `<span class="rc">${escapeChar(char)}</span>`)).join("");
    if (moving) {
      visual.querySelectorAll<HTMLElement>(".rs").forEach((stack) => { stack.style.transition = "none"; stack.style.transform = "translateY(0)"; });
      void visual.offsetWidth;
    }
  }
  const digits = [...text].filter(isDigit);
  const stacks = [...visual.querySelectorAll<HTMLElement>(".rs")];
  stacks.forEach((stack, index) => {
    stack.style.transition = moving ? `transform 760ms cubic-bezier(.23,1,.32,1) ${(stacks.length - 1 - index) * 38}ms` : "none";
    stack.style.transform = `translateY(${-Number(digits[index]) * 1.1}em)`;
  });
  visual.dataset.v = text;
}

/* ---------- cap: satu gerak keras pada satu waktu ---------- */
let loudUntil = 0;
export const loud = (ms: number) => { loudUntil = Math.max(loudUntil, performance.now() + ms); };
export const loudRemaining = () => loudUntil - performance.now();

export function stampSvg(text: string) {
  return `<svg viewBox="0 0 190 64" aria-hidden="true" style="filter:url(#ink)"><rect x="3" y="3" width="184" height="58" rx="9" fill="none" stroke="currentColor" stroke-width="4"/><rect x="10" y="10" width="170" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="95" y="40" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="700" font-size="23" letter-spacing="3" fill="currentColor">${text}</text></svg>`;
}

export const slamFrames = (rot: number): Keyframe[] => [
  { transform: `rotate(${rot - 16}deg) scale(2.4)`, opacity: 0 },
  { transform: `rotate(${rot - 2}deg) scale(.9)`, opacity: 1, offset: 0.55 },
  { transform: `rotate(${rot}deg) scale(1.04)`, opacity: 1, offset: 0.75 },
  { transform: `rotate(${rot}deg) scale(1)`, opacity: 1 },
];

export function landStamp(host: HTMLElement, point: { x: number; y: number }, text: string, options: { w?: number; h?: number; rot?: number; hold?: number } = {}) {
  const el = document.createElement("span");
  const width = options.w ?? 170;
  const height = options.h ?? 56;
  const rot = options.rot ?? -8;
  el.className = "stamp";
  el.style.cssText = `width:${width}px;height:${height}px;left:${point.x - width / 2}px;top:${point.y - height / 2}px`;
  el.innerHTML = stampSvg(text);
  host.appendChild(el);
  if (reducedMotion()) { setTimeout(() => el.remove(), 2200); return Promise.resolve(); }
  const animation = el.animate(slamFrames(rot), { duration: 460, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" });
  animation.finished.then(() => el.classList.add("inked")).catch(() => {});
  animation.finished.then(() => setTimeout(() => el.animate(
    [{ opacity: 1, transform: `rotate(${rot}deg)` }, { opacity: 0, transform: `rotate(${rot}deg) scale(.86) translateY(-6px)` }],
    { duration: 420, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" },
  ).finished.then(() => el.remove()).catch(() => el.remove()), options.hold ?? 1500)).catch(() => {});
  return wait(260);
}

export function thud(el: Element | null) {
  if (el && !reducedMotion()) el.animate([{ transform: "none" }, { transform: "translateY(3px) scale(.995)" }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.23,1,.32,1)" });
}

export function shake(el: Element | null) {
  if (el && !reducedMotion()) el.animate([{ transform: "none" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 360, easing: "ease-in-out" });
}

export function restartClass(el: Element | null, className: string) {
  if (!el) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

/* ---------- salin ---------- */
export type CopyResult = { ok: boolean };

/** Menyalin teks; bila berhasil, cap "TERSALIN" mendarat di dekat tombol (rujukan `copyText`). */
export async function copyWithStamp(text: string, button: HTMLElement | null): Promise<boolean> {
  let done = false;
  try {
    await navigator.clipboard.writeText(text);
    done = true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(area);
      area.select();
      done = document.execCommand("copy");
      area.remove();
    } catch {
      done = false;
    }
  }
  const host = button?.closest<HTMLElement>(".paspor");
  if (done && button && host && !reducedMotion()) {
    const rect = button.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = "stamp";
    el.style.cssText = `position:fixed;width:96px;height:32px;left:${Math.min(rect.right - 70, innerWidth - 100)}px;top:${rect.top - 18}px;color:var(--up);z-index:60`;
    el.innerHTML = stampSvg("TERSALIN");
    host.appendChild(el);
    el.animate(
      [{ transform: "rotate(-22deg) scale(2)", opacity: 0 }, { transform: "rotate(-8deg) scale(1)", opacity: 1, offset: 0.5 }, { transform: "rotate(-8deg) scale(1)", opacity: 1, offset: 0.85 }, { transform: "rotate(-8deg) scale(.9)", opacity: 0 }],
      { duration: 1300, easing: "cubic-bezier(.23,1,.32,1)" },
    ).finished.then(() => el.remove()).catch(() => el.remove());
  }
  return done;
}
