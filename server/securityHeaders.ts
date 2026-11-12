import type { NextFunction, Request, Response } from "express";

/**
 * Header keamanan untuk setiap respons.
 *
 * Yang utama `frame-ancestors 'none'`: aktivasi kurs dan persetujuan berjalan dengan satu klik, jadi halaman
 * ini tidak boleh dibingkai situs lain (clickjacking). `script-src` sengaja BELUM dibatasi: jendela cetak
 * surat/lampiran menulis `<script>window.print()</script>` ke jendela kosong yang mewarisi CSP halaman ini.
 * Batasi sesudah pencetakan dipicu dari jendela pembuka.
 */
export function securityHeaders(options: { isProduction: boolean }) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    // HSTS hanya di produksi (di balik HTTPS); di mesin pengembang ia mengunci localhost ke https.
    if (options.isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  };
}
