/**
 * Kode rahasia yang dibaca manusia: kode penyiapan (dari terminal server) dan kode pemulihan pemilik
 * (dicetak di kertas). Alfabet 32 huruf tanpa 0/O dan 1/I supaya tidak salah dibaca; tepat 32
 * sehingga `byte & 31` menghasilkan sebaran seragam tanpa penolakan sampel.
 *
 * Yang di-hash selalu bentuk rapat dari `normalizeSecretCode` — tanpa strip, huruf besar — supaya
 * ketikan "abcd efgh" dan "ABCD-EFGH" adalah kode yang sama.
 */
export const SECRET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 8;
/** Kode pemulihan: XXXX-XXXX. */
export const RECOVERY_CODE_GROUPS = 2;
/** Kode penyiapan: XXXX-XXXX-XXXX. */
export const SETUP_CODE_GROUPS = 3;

type RandomBytes = (length: number) => Uint8Array;
const secureRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export function generateSecretCode(groups: number, random: RandomBytes = secureRandom): string {
  const chars = Array.from(random(groups * 4), (byte) => SECRET_CODE_ALPHABET[byte & 31]).join("");
  return formatSecretCode(chars);
}

export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateSecretCode(RECOVERY_CODE_GROUPS));
  return [...codes];
}

export function normalizeSecretCode(input: string, groups: number): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (compact.length !== groups * 4) return null;
  for (const char of compact) if (!SECRET_CODE_ALPHABET.includes(char)) return null;
  return compact;
}

export function formatSecretCode(compact: string): string {
  return (compact.match(/.{1,4}/g) ?? []).join("-");
}
