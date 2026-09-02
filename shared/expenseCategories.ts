export const EXPENSE_CATEGORY_LABELS = {
  SEWA: "Sewa tempat",
  GAJI: "Gaji dan tunjangan",
  UTILITAS: "Utilitas (listrik/air/internet)",
  PERLENGKAPAN_OPERASIONAL: "Perlengkapan operasional",
  PEMASARAN: "Pemasaran",
  PEMELIHARAAN: "Pemeliharaan dan perbaikan",
  IZIN_DAN_PAJAK: "Izin dan pajak",
  LAINNYA: "Lainnya",
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORY_LABELS;

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
