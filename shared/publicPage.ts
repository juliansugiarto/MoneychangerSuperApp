/**
 * Isian halaman kurs publik (spec 2026-09-26 §4–§5). Bagian yang kosong disembunyikan; FAQ dan
 * peringatan penipuan memakai teks produk netral — tanpa nama perusahaan, tanpa nomor — sampai
 * pemilik mengisinya. Tidak ada teks milik perusahaan mana pun yang ditulis mati di sini.
 */
import { checkOpeningSchedule, type OpeningSchedule } from "./openingStatus";

export type PublicFaqItem = { question: string; answer: string };

/**
 * Ketentuan uang (spec teks §4): tiga butir yang diisi pemilik. Semua kosong = halaman memakai
 * `DEFAULT_MONEY_RULES` (keputusan pemilik 12 Nov 2026: "isi dulu dengan yang umum").
 */
export type MoneyRules = { denominations: string | null; condition: string | null; series: string | null };
export const MONEY_RULE_MAX_LENGTH = 500;

export function hasMoneyRules(rules: Partial<MoneyRules> | null | undefined): boolean {
  return Boolean(rules && [rules.denominations, rules.condition, rules.series].some((value) => value?.trim()));
}

/**
 * Ketentuan umum yang berlaku di hampir semua money changer, tanpa nama atau angka perusahaan. Sengaja
 * memakai "bisa": tidak menjanjikan penerimaan maupun penolakan tertentu atas nama outlet.
 */
export const DEFAULT_MONEY_RULES: MoneyRules = {
  denominations: "Kurs bisa berbeda menurut pecahan. Pecahan besar, misalnya USD 100, biasanya mendapat kurs lebih baik daripada pecahan kecil.",
  condition: "Uang yang robek, bercoret, berstempel, atau rusak bisa ditolak atau mendapat kurs lebih rendah. Petugas memeriksa setiap lembar.",
  series: "Uang seri lama bisa mendapat kurs berbeda atau tidak diterima. Tanyakan petugas bila uang Anda seri lama.",
};

/** Ketentuan milik perusahaan bila ada isinya; selain itu ketentuan umum. */
export function moneyRulesOrDefault(rules: Partial<MoneyRules> | null | undefined): MoneyRules {
  return rules && hasMoneyRules(rules)
    ? { denominations: rules.denominations?.trim() || null, condition: rules.condition?.trim() || null, series: rules.series?.trim() || null }
    : DEFAULT_MONEY_RULES;
}

export const PUBLIC_FAQ_LIMIT = 12;

/**
 * Delapan tanya-jawab bawaan halaman publik (spec teks 2026-11-12 §8, 1–8). Tanpa nama, alamat, atau nomor
 * perusahaan; jawaban "kapan dan di mana" serta "memastikan kontak" disusun halaman dari Profil Perusahaan.
 * Batas USD 10.000 adalah aturan BI (PADG 15/2026) untuk semua KUPVA, bukan teks satu perusahaan.
 */
export const DEFAULT_PUBLIC_FAQ: readonly PublicFaqItem[] = [
  { question: "Apa itu valas?", answer: "Valas adalah uang asing, misalnya dolar AS atau riyal Saudi. Anda bisa melihat kursnya di bagian Kurs." },
  { question: "Saya jual atau beli valas?", answer: "Pilih “Saya jual valas” jika Anda menyerahkan uang asing dan menerima rupiah. Pilih “Saya beli valas” jika Anda membayar rupiah untuk mendapat uang asing." },
  { question: "Apakah kurs di sini sudah pasti?", answer: "Kurs di halaman ini masih perkiraan. Petugas memastikan kurs dan pecahan yang tersedia sebelum transaksi." },
  { question: "Kenapa beda pecahan beda kurs?", answer: "Kurs bisa berbeda menurut pecahan uang, misalnya USD 100 dan pecahan kecil. Pilih pecahan yang sesuai saat menghitung, lalu pastikan kursnya dengan petugas." },
  { question: "Bagaimana total rupiah dibulatkan?", answer: "Total rupiah dibulatkan ke atas dalam kelipatan Rp 100. Aturan ini berlaku saat Anda menjual maupun membeli valas." },
  { question: "Apa yang perlu saya bawa?", answer: "Bawa KTP atau paspor Anda. Jika total pembelian valas Anda melebihi USD 10.000 atau setaranya per bulan, bawa juga dokumen pendukung dan NPWP." },
  { question: "Bagaimana pembelian sampai USD 10.000?", answer: "Anda menandatangani pernyataan bahwa pembelian valas Anda pada bulan itu belum melebihi USD 10.000 atau setaranya. Batas dihitung per orang per bulan. Bawa KTP atau paspor Anda." },
  { question: "Apakah formulir ini memesan valas?", answer: "Formulir ini hanya untuk meminta konfirmasi kurs dan pecahan yang tersedia. Ini bukan pemesanan atau transaksi. Petugas akan menghubungi Anda; kurs belum dikunci." },
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
