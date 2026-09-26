/** Aturan akun yang sama untuk server (penegak) dan layar (petunjuk sebelum dikirim). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,48}$/;
export const PASSWORD_MIN_LENGTH = 12;

export function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase();
}
