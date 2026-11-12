import { brandInitials } from "@/components/shell/brand";
import { scheduleLines, type OpeningSchedule } from "@shared/openingStatus";
import { DEFAULT_PUBLIC_FAQ, type PublicFaqItem } from "@shared/publicPage";
import { formatRupiahNumber, rateChange, sortPublicRates, type PublicRateRow, type RateChange } from "@shared/publicRates";
import { pricedRowRupiah } from "@shared/rupiahRounding";
import Decimal from "decimal.js";

/** Arah dari sisi pelanggan, sama dengan rujukan: "jual" = pelanggan menjual valas = kurs beli perusahaan. */
export type Dir = "jual" | "beli";
export const otherDir = (dir: Dir): Dir => (dir === "jual" ? "beli" : "jual");
export const dirName = (dir: Dir) => (dir === "jual" ? "Anda jual" : "Anda beli");

export const fmt = (value: number) => formatRupiahNumber(value);
export const rp = (value: number) => `Rp ${fmt(value)}`;

export type RateView = {
  id: string;
  rateId: number;
  currencyId: number;
  code: string;
  name: string;
  /** Kolom Pecahan tabel ("100 USD", "Pecahan lainnya", "Semua pecahan"). */
  den: string;
  /** Penanda pecahan ringkas di daftar ponsel dan baris MRZ. */
  mden: string;
  unit: number;
  unitText: string;
  jual: number;
  beli: number;
  chg: Record<Dir, RateChange>;
  effectiveAt: Date;
};

export function toRateViews(rows: readonly PublicRateRow[]): RateView[] {
  const tiered = new Set(rows.filter((row) => row.tier).map((row) => row.currency.id));
  return sortPublicRates(rows).map((row) => {
    const unit = new Decimal(row.rate.quoteUnit).toNumber();
    const den = row.tier ? `${row.tier.label} ${row.currency.code}` : tiered.has(row.currency.id) ? "Pecahan lainnya" : "Semua pecahan";
    const mden = row.tier ? row.tier.label : tiered.has(row.currency.id) ? "lainnya" : unit !== 1 ? `per ${unit}` : "semua";
    return {
      id: `${row.currency.id}-${row.tier?.id ?? "all"}`,
      rateId: row.rate.id,
      currencyId: row.currency.id,
      code: row.currency.code,
      name: row.currency.name,
      den,
      mden,
      unit,
      unitText: `Per ${unit} ${row.currency.code}`,
      jual: new Decimal(row.rate.buyRate).toNumber(),
      beli: new Decimal(row.rate.sellRate).toNumber(),
      chg: { jual: rateChange(row, "SELL"), beli: rateChange(row, "BUY") },
      effectiveAt: new Date(row.rate.effectiveAt),
    };
  });
}

export function changeLabel(change: RateChange): { k: RateChange["kind"]; t: string } {
  if (change.kind === "none") return { k: "none", t: "Belum ada pembanding" };
  if (change.kind === "flat") return { k: "flat", t: "Tetap" };
  return { k: change.kind, t: `${change.kind === "up" ? "Naik" : "Turun"} ${fmt(Number(change.amount))}` };
}

/* ---------- kalkulator ---------- */
export type ParsedAmount = { value: string } | { error: "empty" | "nan" | "neg" };

/** Rujukan `parseAmt`: "1.500", "1.500,5", "500,25", "500.25" diterima; jumlah ≤ 0 ditolak. */
export function parseAmount(raw: string): ParsedAmount {
  const text = raw.trim().replace(/\s/g, "");
  if (!text) return { error: "empty" };
  if (text.startsWith("-")) return { error: "neg" };
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d+)?$/.test(text)) normalized = text.replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(text)) normalized = text;
  else return { error: "nan" };
  return new Decimal(normalized).gt(0) ? { value: new Decimal(normalized).toString() } : { error: "neg" };
}

export const AMOUNT_ERRORS = {
  cur: "Mata uang belum dipilih. Pilih mata uang yang ingin Anda tukar.",
  den: "Pecahan belum dipilih. Pilih pecahan uang Anda.",
  empty: "Jumlah valas belum diisi. Isi jumlah yang ingin Anda tukar.",
  nan: "Jumlah valas belum terbaca. Isi dengan angka, misalnya 500.",
  neg: "Jumlah valas harus lebih dari 0. Periksa jumlah yang Anda isi.",
} as const;

/** Total rupiah dengan pembulatan kasir (ke atas, kelipatan Rp 100), `shared/rupiahRounding.ts`. */
export function estimateTotal(rate: RateView, dir: Dir, amount: string): number {
  return pricedRowRupiah(amount, 1, rate[dir], rate.unit).toNumber();
}

/** Batang kode dari angka perhitungan (rujukan `drawBarcode`). */
export function barcodeBars(seed: string): { width: number; bars: { x: number; w: number }[] } {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (const char of seed) {
    const digit = char >= "0" && char <= "9" ? Number(char) : 5;
    const widths = [1 + (digit & 1), 1 + ((digit >> 1) & 1) * 2, 1 + ((digit >> 2) & 1), 2 + (digit % 3)];
    widths.forEach((width, index) => { if (index % 2 === 0) bars.push({ x, w: width }); x += width; });
  }
  return { width: Math.max(x, 1), bars };
}

/* ---------- identitas dari Profil Perusahaan (white-label: tidak ada nama yang ditulis mati) ---------- */
export type Identity = { name: string; initials: string; city: string | null; street: string | null };

/** Kota = bagian terakhir alamat ("…, Solokpandan, Cianjur" → "Cianjur"); jalan = bagian pertama tanpa nomor. */
export function identityFrom(profile: { tradingName?: string | null; address?: string | null }): Identity {
  const name = profile.tradingName?.trim() || "Money changer";
  const parts = (profile.address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    name,
    initials: brandInitials(name),
    city: parts.length > 1 ? parts[parts.length - 1] : null,
    street: parts[0] ? parts[0].replace(/\s+No\.?\s*\d.*$/i, "") || null : null,
  };
}

/** Teks MRZ: huruf besar ASCII, selain huruf/angka menjadi "<". */
export function mrz(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "<").replace(/^<|<$/g, "");
}

export const mrzPad = (text: string, length: number) => (text.length >= length ? text : text + "<".repeat(length - text.length));

/** "0812-3456-7890" → "https://wa.me/6281234567890"; nomor yang tidak terbaca = null. */
export function whatsappHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.startsWith("0") ? `62${digits.slice(1)}` : digits}`;
}

/** FAQ: milik perusahaan bila diisi; selain itu delapan bawaan + dua jawaban yang disusun dari profil (spec §8 no. 9–10). */
export function faqItems(custom: PublicFaqItem[] | null | undefined, profile: { address?: string | null; openingSchedule?: OpeningSchedule | null; timezone?: string; phone?: string | null }): PublicFaqItem[] {
  const own = (custom ?? []).filter((item) => item.question.trim() && item.answer.trim());
  if (own.length) return own;
  const items = [...DEFAULT_PUBLIC_FAQ];
  const lines = scheduleLines(profile.openingSchedule, profile.timezone);
  if (profile.address?.trim()) {
    const hours = lines.map((line) => {
      const [days, hours] = line.split(": ");
      return hours === "Tutup" ? ` ${days} tutup.` : ` Buka ${days}, ${hours}.`;
    }).join("");
    items.push({ question: "Kapan dan di mana saya datang?", answer: `Kami di ${profile.address.trim().replace(/\.$/, "")}.${hours}` });
  }
  if (profile.phone?.trim()) {
    items.push({ question: "Bagaimana memastikan kontak perusahaan?", answer: `Cocokkan nomor yang menghubungi Anda dengan nomor di halaman ini. Kami tidak pernah meminta transfer lewat chat pribadi. Jika ragu, telepon ${profile.phone.trim()}.` });
  }
  return items;
}
