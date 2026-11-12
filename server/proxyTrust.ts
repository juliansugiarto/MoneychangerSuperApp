import type { Express } from "express";

/**
 * Pembalik (nginx/Caddy) meneruskan alamat asli lewat X-Forwarded-For. Hanya peer yang dipercaya boleh mengisinya:
 * header itu dari siapa pun yang lain adalah karangan. Tanpa ini setiap permintaan berasal dari alamat pembalik dan
 * pembatas percobaan per IP mengunci semua orang sekaligus.
 *
 * Bawaan `loopback` (pembalik di mesin yang sama). Di tumpukan Docker (deploy/vps) Caddy berada di kontainer lain, jadi
 * `TRUST_PROXY=loopback, 172.30.0.254`: HANYA alamat tetap Caddy di jaringan mc_edge (bukan seluruh jaringan privat —
 * kontainer lain di jaringan yang sama tidak boleh bisa memalsukan IP). Caddy mengganti X-Forwarded-For dengan SATU
 * nilai (IP pengunjung dari CF-Connecting-IP), jadi entri yang dibaca Express selalu buatan Caddy.
 */
export function trustProxySetting(raw = process.env.TRUST_PROXY): string {
  const value = raw?.trim();
  return value ? value : "loopback";
}

export function configureProxyTrust(app: Express, setting = trustProxySetting()) {
  app.set("trust proxy", setting);
}

export function clientIpOf(req: { ip?: string }): string {
  return req.ip || "unknown";
}
