/**
 * Kode penyiapan untuk wizard "Siapkan perusahaan Anda". Dibuat penginstal di server, tidak pernah
 * dicetak ke log aplikasi. Berkas .mjs tidak dapat mengimpor TypeScript, jadi alfabet dan format
 * hash di sini adalah salinan `shared/secretCodes.ts` dan `hashSecret` di `server/internalAuth.ts`;
 * `server/setupCodeScript.test.ts` memaku ketiganya supaya tidak menyimpang.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
export const SETUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSetupCode() {
  const chars = Array.from(randomBytes(12), (byte) => SETUP_CODE_ALPHABET[byte & 31]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export async function hashSetupCode(code) {
  const compact = code.toUpperCase().replace(/[\s-]/g, "");
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(compact, salt, 64);
  return `scrypt$v1$${salt}$${hash.toString("base64url")}`;
}

/**
 * Menulis kode baru untuk basis data yang tersambung dan mengembalikannya satu kali. Menolak bila
 * penyiapan sudah selesai. Kedaluwarsa dihitung basis data dalam UTC — `new Date()` lewat mysql2
 * akan tertulis sebagai jam lokal WIB.
 */
export async function writeSetupCode(connection) {
  const [rows] = await connection.query("SELECT setupCompletedAt FROM app_installation WHERE id = 1");
  if (rows[0]?.setupCompletedAt) throw new Error("Penyiapan sudah selesai. Kode penyiapan tidak dapat dibuat lagi.");
  const code = generateSetupCode();
  const hash = await hashSetupCode(code);
  await connection.query(
    "INSERT INTO app_installation (id, setupCodeHash, setupCodeExpiresAt) VALUES (1, ?, UTC_TIMESTAMP() + INTERVAL 24 HOUR) "
      + "ON DUPLICATE KEY UPDATE setupCodeHash = ?, setupCodeExpiresAt = UTC_TIMESTAMP() + INTERVAL 24 HOUR",
    [hash, hash],
  );
  return code;
}
