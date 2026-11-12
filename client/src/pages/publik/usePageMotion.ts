import { useEffect, useRef, useState } from "react";
import { loudRemaining, reducedMotion, restartClass, wait } from "./motion";

/**
 * Lapis gerak halaman (rujukan bagian "stamp-in tags", "spreads open", "visibility", "arrival"):
 * - tag bagian dicap satu per satu saat terlihat (antre, tidak bertabrakan dengan gerak keras lain);
 * - spread membuka di lipatannya saat tiba di layar, mulai dari keadaan terlihat;
 * - gerak latar berhenti saat tab tersembunyi (kelas `paused`).
 * Dipasang sesudah kedatangan selesai, sama dengan rujukan.
 */
export function usePageMotion(rootRef: React.RefObject<HTMLDivElement | null>, ready: boolean, armed: boolean, contentKey: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;
    const onVisibility = () => root.classList.toggle("paused", document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [rootRef, ready]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || !armed || reducedMotion()) return;
    const queue: Element[] = [];
    let busy = false; let disposed = false;
    const pump = () => {
      if (disposed || busy || !queue.length) return;
      const remaining = loudRemaining();
      if (remaining > 0) { setTimeout(pump, remaining + 40); return; }
      busy = true;
      restartClass(queue.shift()!, "slam");
      setTimeout(() => { busy = false; pump(); }, 420);
    };
    const stamps = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      stamps.unobserve(entry.target); queue.push(entry.target); pump();
    }), { threshold: 0.6 });
    root.querySelectorAll<HTMLElement>("[data-stamp]").forEach((el) => {
      if (!el.style.getPropertyValue("--rot")) el.style.setProperty("--rot", `${(Math.random() * 8 - 4).toFixed(1)}deg`);
      if (!el.dataset.stamped) { el.dataset.stamped = "1"; stamps.observe(el); }
    });
    const spreads = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spreads.unobserve(entry.target);
      const el = entry.target as HTMLElement;
      el.style.setProperty("--ry", `${Number(el.dataset.k) % 2 ? -3 : 3}deg`);
      restartClass(el, "opening");
    }), { threshold: 0.12 });
    root.querySelectorAll<HTMLElement>("main .spread").forEach((el, index) => {
      if (!index || el.dataset.k) return;
      el.dataset.k = String(index);
      spreads.observe(el);
    });
    return () => { disposed = true; stamps.disconnect(); spreads.disconnect(); };
  }, [rootRef, ready, armed, contentKey]);
}

const SEEN_KEY = "paspor-arrived";
const seenBefore = () => { try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* penyimpanan diblokir: kedatangan tampil lagi, tidak apa-apa */ } };

/**
 * Sampul paspor terbuka saat kedatangan (≤ 1,3 s, sekali per sesi, ketuk/tombol = lewati). Tulisan "Kurs terbaru …"
 * hanya muncul bila kurs benar-benar sudah termuat; kalau belum, sampul tidak menahan pengunjung.
 */
/** `ready` = halaman sungguhan sudah dirender (bukan wadah "memuat profil"), sehingga `rootRef` terpasang. */
export function useArrival(rootRef: React.RefObject<HTMLDivElement | null>, ready: boolean, latestText: () => string | null, names: string[]) {
  const [done, setDone] = useState(() => reducedMotion() || seenBefore());
  const latest = useRef(latestText);
  latest.current = latestText;

  useEffect(() => {
    const root = rootRef.current;
    if (done || !root || !ready) return;
    markSeen();
    const overlay = document.createElement("div");
    overlay.className = "arr";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="arr-cover"><span class="seal arr-seal"><svg><use href="#logo"/></svg></span><div class="arr-name">${names.map((name) => name.replace(/[<&]/g, "")).join("<br>")}</div></div><p class="arr-st">Memuat kurs…</p>`;
    root.appendChild(overlay);
    const cover = overlay.querySelector<HTMLElement>(".arr-cover")!;
    const status = overlay.querySelector<HTMLElement>(".arr-st")!;
    const seal = overlay.querySelector<HTMLElement>(".arr-seal")!;
    const header = root.querySelector<HTMLElement>("#hdrSeal");
    let skipped = false;
    const finish = () => {
      if (!overlay.isConnected) return;
      overlay.remove();
      root.querySelectorAll(".arr-fly").forEach((el) => el.remove());
      if (header) header.style.opacity = "";
      setDone(true);
    };
    const skip = () => { skipped = true; finish(); };
    addEventListener("pointerdown", skip, { once: true });
    addEventListener("keydown", skip, { once: true });
    if (header) header.style.opacity = "0";
    (async () => {
      cover.animate([{ transform: "translateY(26px) scale(.94)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" });
      await wait(260);
      // Tunggu data kurs paling lama ±450 ms lagi; jangan menahan pengunjung.
      for (let waited = 0; !latest.current() && waited < 450 && !skipped; waited += 50) await wait(50);
      if (skipped) return;
      const text = latest.current();
      if (text) {
        status.textContent = `Kurs terbaru ${text}`;
        status.animate([{ transform: "scale(1.3)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 200, easing: "cubic-bezier(.23,1,.32,1)" });
        await wait(220);
      }
      if (skipped || !header) { finish(); return; }
      const from = seal.getBoundingClientRect(); const to = header.getBoundingClientRect();
      const fly = document.createElement("span");
      fly.className = "seal arr-fly";
      fly.style.cssText = `position:fixed;z-index:130;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;transform-origin:0 0`;
      fly.innerHTML = '<svg aria-hidden="true"><use href="#logo"/></svg>';
      root.appendChild(fly);
      seal.style.visibility = "hidden";
      fly.animate([{ transform: "none", color: "#E4CC8C" }, { transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.width / from.width}) rotate(-360deg)`, color: "#7A1C2C" }], { duration: 520, easing: "cubic-bezier(.6,.05,.25,1)", fill: "forwards" });
      cover.animate([{ transform: "none" }, { transform: "rotateY(-118deg)", opacity: 0 }], { duration: 480, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" });
      status.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
      await overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 100, easing: "ease-out", fill: "forwards" }).finished.catch(() => {});
      if (skipped) return;
      finish();
      header.animate([{ transform: "scale(1.25) rotate(-8deg)" }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
      root.querySelector("#kurs .hero")?.classList.add("ink-in");
    })();
    return () => {
      // Dilepas sebelum selesai (mis. StrictMode memasang ulang): bersihkan tanpa menandai selesai.
      skipped = true;
      removeEventListener("pointerdown", skip); removeEventListener("keydown", skip);
      overlay.remove();
      root.querySelectorAll(".arr-fly").forEach((el) => el.remove());
      if (header) header.style.opacity = "";
    };
    // Sekali, begitu halaman siap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return done;
}
