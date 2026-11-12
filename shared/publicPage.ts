/**
 * Isian halaman kurs publik (spec 2026-09-26 §4–§5). Bagian yang kosong disembunyikan; FAQ dan
 * peringatan penipuan memakai teks produk netral — tanpa nama perusahaan, tanpa nomor — sampai
 * pemilik mengisinya. Tidak ada teks milik perusahaan mana pun yang ditulis mati di sini.
 */
import { checkOpeningSchedule, type OpeningSchedule } from "./openingStatus";

export type PublicFaqItem = { question: string; answer: string };

/**
 * Ketentuan uang (spec teks §4): tiga butir faktual yang diisi pemilik. Semua kosong = bagian
 * disembunyikan; tidak ada teks bawaan karena ketentuan penerimaan uang tidak boleh ditebak.
 */
export type MoneyRules = { denominations: string | null; condition: string | null; series: string | null };
export const MONEY_RULE_MAX_LENGTH = 500;

export function hasMoneyRules(rules: Partial<MoneyRules> | null | undefined): boolean {
  return Boolean(rules && [rules.denominations, rules.condition, rules.series].some((value) => value?.trim()));
}

export const PUBLIC_FAQ_LIMIT = 12;

export const DEFAULT_PUBLIC_FAQ: readonly PublicFaqItem[] = [
  { question: "Apakah kurs di halaman ini sudah terkunci?", answer: "Belum. Kurs bersifat indikatif; petugas mengonfirmasi kurs dan ketersediaan sebelum transaksi dilakukan." },
  { question: "Apakah formulir permintaan merupakan transaksi?", answer: "Tidak. Formulir hanya membantu kami memahami kebutuhan awal Anda. Formulir tidak mengunci kurs, tidak meminta data identitas, dan tidak meminta pembayaran." },
  { question: "Apa yang perlu dibawa ke outlet?", answer: "Siapkan kebutuhan mata uang dan nominal Anda. Petugas akan memberi arahan mengenai informasi yang diperlukan sesuai prosedur layanan." },
];

export const DEFAULT_FRAUD_WARNING = "Waspada penipuan. Konfirmasi ulang lewat kontak resmi di halaman ini sebelum menindaklanjuti informasi yang mengatasnamakan kami.";

export function publicFaqOrDefault(faq: readonly PublicFaqItem[] | null | undefined): readonly PublicFaqItem[] {
  const filled = (faq ?? []).filter((item) => item.question.trim() && item.answer.trim());
  return filled.length ? filled : DEFAULT_PUBLIC_FAQ;
}

export function fraudWarningOrDefault(text: string | null | undefined): string {
  return text?.trim() || DEFAULT_FRAUD_WARNING;
}

export function isSafeMapUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

type ContactFields = { address?: string | null; phone?: string | null; secondaryPhone?: string | null; openingHours?: string | null; mapUrl?: string | null };

export function hasContactSection(profile: ContactFields): boolean {
  return [profile.address, profile.phone, profile.secondaryPhone, profile.openingHours, profile.mapUrl].some((value) => Boolean(value?.trim()));
}

export type PublicPageInput = {
  publicPageEnabled: boolean;
  secondaryPhone?: string | null;
  openingHours?: string | null;
  mapUrl?: string | null;
  publicFaq: PublicFaqItem[];
  fraudWarning?: string | null;
  openingSchedule?: OpeningSchedule | null;
  moneyRules?: Partial<MoneyRules> | null;
};

export type PublicPageValues = {
  publicPageEnabled: boolean;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
  openingSchedule: OpeningSchedule | null;
  moneyRules: MoneyRules | null;
};

const blankToNull = (value: string | null | undefined) => value?.trim() || null;

/** Dipakai layar (untuk menonaktifkan "Simpan" dan menyebut alasannya) dan server (penegak sesungguhnya). */
export function normalizePublicPage(input: PublicPageInput): { ok: true; values: PublicPageValues } | { ok: false; error: string } {
  const mapUrl = blankToNull(input.mapUrl);
  if (mapUrl && !isSafeMapUrl(mapUrl)) return { ok: false, error: "Tautan peta harus diawali https://, mis. tautan bagikan dari Google Maps." };
  if (input.publicFaq.length > PUBLIC_FAQ_LIMIT) return { ok: false, error: `Paling banyak ${PUBLIC_FAQ_LIMIT} pertanyaan. Hapus yang kurang penting.` };
  const faq = input.publicFaq.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }));
  const incomplete = faq.findIndex((item) => !item.question || !item.answer);
  if (incomplete >= 0) return { ok: false, error: `Pertanyaan ke-${incomplete + 1} belum lengkap. Isi pertanyaan dan jawabannya, atau hapus barisnya.` };
  const schedule = checkOpeningSchedule(input.openingSchedule ?? null);
  if (!schedule.ok) return schedule;
  const rules: MoneyRules = {
    denominations: blankToNull(input.moneyRules?.denominations),
    condition: blankToNull(input.moneyRules?.condition),
    series: blankToNull(input.moneyRules?.series),
  };
  if (Object.values(rules).some((value) => value && value.length > MONEY_RULE_MAX_LENGTH)) {
    return { ok: false, error: `Setiap ketentuan uang paling panjang ${MONEY_RULE_MAX_LENGTH} huruf. Ringkas kalimatnya.` };
  }
  return {
    ok: true,
    values: {
      publicPageEnabled: input.publicPageEnabled,
      secondaryPhone: blankToNull(input.secondaryPhone),
      openingHours: blankToNull(input.openingHours),
      mapUrl,
      publicFaq: faq.length ? faq : null,
      fraudWarning: blankToNull(input.fraudWarning),
      openingSchedule: schedule.value,
      moneyRules: hasMoneyRules(rules) ? rules : null,
    },
  };
}
