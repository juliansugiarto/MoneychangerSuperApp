import type { Express } from "express";

/**
 * nginx berjalan di mesin yang sama dan meneruskan alamat asli lewat X-Forwarded-For. Hanya peer
 * loopback yang dipercaya: header itu dari siapa pun yang lain adalah karangan. Tanpa ini setiap
 * permintaan ber-IP 127.0.0.1 dan pembatas percobaan per IP mengunci semua orang sekaligus.
 */
export function configureProxyTrust(app: Express) {
  app.set("trust proxy", "loopback");
}

export function clientIpOf(req: { ip?: string }): string {
  return req.ip || "unknown";
}
