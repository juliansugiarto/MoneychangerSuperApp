import type { NextFunction, Request, Response } from "express";

/**
 * Dua alamat untuk satu aplikasi (keputusan pemilik 12 Nov 2026): alamat publik (mis. contohvalas.co.id) hanya
 * melayani halaman kurs untuk nasabah; back office (mis. backoffice.contohvalas.co.id) melayani login dan semua
 * layar staf. Diatur lewat PUBLIC_HOST dan BACKOFFICE_HOST; bila salah satunya kosong (pengembangan lokal), tidak ada
 * pemisahan dan semua jalur dilayani di alamat mana pun.
 *
 * - Alamat publik: jalur staf (/login, /operasional/…, /kepatuhan/…, /siapkan, /pulihkan, /ubah-sandi) dialihkan ke
 *   back office dengan jalur yang sama. Sesi login (cookie host-only) hanya pernah ada di back office.
 * - Back office: "/" dialihkan ke /login (halaman login sendiri meneruskan staf yang sudah masuk ke /operasional).
 * - /api dan berkas statis tidak pernah dialihkan; `www.` alamat publik ditangani Caddy.
 */
const STAFF_PATH = /^\/(login|siapkan|pulihkan|ubah-sandi|operasional|kepatuhan)(\/|$)/;

export type HostSplit = { publicHost: string; backofficeHost: string };

export function hostSplitFromEnv(env = process.env): HostSplit | null {
  const publicHost = env.PUBLIC_HOST?.trim().toLowerCase();
  const backofficeHost = env.BACKOFFICE_HOST?.trim().toLowerCase();
  return publicHost && backofficeHost ? { publicHost, backofficeHost } : null;
}

/** Tujuan pengalihan untuk permintaan ini, atau null bila dilayani di tempat. */
export function hostSplitRedirect(split: HostSplit, host: string, originalUrl: string): string | null {
  const hostname = host.toLowerCase();
  const path = originalUrl.split("?")[0] ?? "/";
  if (path.startsWith("/api/")) return null;
  if (hostname === split.publicHost && STAFF_PATH.test(path)) return `https://${split.backofficeHost}${originalUrl}`;
  if (hostname === split.backofficeHost && path === "/") return "/login";
  return null;
}

export function hostSplitMiddleware(split: HostSplit | null = hostSplitFromEnv()) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!split || (req.method !== "GET" && req.method !== "HEAD")) return next();
    const target = hostSplitRedirect(split, req.hostname, req.originalUrl);
    return target ? res.redirect(302, target) : next();
  };
}
