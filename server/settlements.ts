/**
 * Pelunasan kewajiban dan penagihan piutang — sisi kas yang selama ini hilang.
 *
 * `mapExpense` dan `mapFixedAssetAcquisition` sama-sama mengkredit 2-1900, dan
 * `mapFixedAssetDisposal` mendebit 1-1320, karena modul di luar sistem kas yang menyentuh 1-1110
 * membuat kas buku besar berbeda dari `cash_balances` — temuan pemeriksaan 7.2/7.3. Lanjutan yang
 * dijanjikan komentar `mapExpense`, "pelunasannya dijurnal terpisah saat kas benar-benar keluar",
 * tidak pernah ditulis sampai paket F2. Akibatnya tidak ada satu pun pembayaran beban maupun
 * perolehan aset yang pernah menjadi arus kas.
 *
 * Berkas ini menuliskannya, dan hanya itu tugasnya: ia menulis mutasi kas beserta pecahannya dan
 * baris `ledger_settlements` yang menyebut apa yang dilunasi. **Ia tidak menjurnal.**
 * Penjurnalannya tetap lewat `postOperationsToLedger` atas rentang tanggal yang dipilih manusia,
 * persis seperti setoran modal dan pemindahan kas↔bank — satu jalur penjurnalan, bukan dua.
 */

import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";
import {
  bankAccountMovements,
  bankAccounts,
  currencies,
  fixedAssets,
  ledgerSettlements,
  operationalExpenses,
} from "../drizzle/schema";
import { calendarDay } from "../shared/ledger";
import { dbDate } from "./ledgerOperations";
import {
  applyCashMovement,
  databaseOrThrow,
  nonNegativeOrZeroDecimal,
  reconcileDenominations,
  retryTransientDatabaseRead,
  writeAudit,
  type DenominationEntryInput,
} from "./operations";
import type { StaffRole } from "../drizzle/schema";

export type SettlementTargetType = "BEBAN" | "ASET_TETAP";
export type SettlementDirection = "PEMBAYARAN" | "PENERIMAAN";

export type OutstandingSettlement = {
  direction: SettlementDirection;
  targetType: SettlementTargetType;
  targetId: number;
  label: string;
  /** Tanggal kejadian asalnya — tanggal beban, perolehan, atau pelepasan. */
  originDate: string;
  originalAmount: string;
  settledAmount: string;
  outstandingAmount: string;
  /** Jurnal yang membentuk kewajiban atau piutangnya; NULL berarti belum dijurnal. */
  journalEntryId: number | null;
};

const money = (value: Decimal) => value.toFixed(2);

const keyOf = (targetType: SettlementTargetType, targetId: number) => `${targetType}:${targetId}`;

/**
 * Sisa tagihan dan sisa piutang, dihitung dari kejadian asalnya dikurangi pelunasan yang sudah
 * tercatat.
 *
 * Aset **warisan** (`acquisitionJournalEntryId` NULL) sengaja tidak muncul: asetnya masuk lewat
 * jalur `SALDO_AWAL`, bukan lewat 2-1900, sehingga tidak pernah ada kewajiban yang dapat dilunasi.
 * Menagihkan pelunasan atasnya akan mendebit kewajiban yang tidak pernah ada, dan 2-1900 menjadi
 * bersaldo debit tanpa ada yang menolaknya.
 */
export async function listOutstandingSettlements() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const [expenses, assets, settlements] = await Promise.all([
      db.select().from(operationalExpenses),
      db.select().from(fixedAssets),
      db.select().from(ledgerSettlements),
    ]);

    const settledByTarget = new Map<string, Decimal>();
    for (const row of settlements) {
      const targetId = row.targetType === "BEBAN" ? row.expenseId : row.fixedAssetId;
      if (!targetId) continue;
      const key = `${row.direction}:${keyOf(row.targetType as SettlementTargetType, targetId)}`;
      settledByTarget.set(key, (settledByTarget.get(key) ?? new Decimal(0)).plus(String(row.amount)));
    }
    const settledFor = (direction: SettlementDirection, targetType: SettlementTargetType, targetId: number) =>
      settledByTarget.get(`${direction}:${keyOf(targetType, targetId)}`) ?? new Decimal(0);

    const payables: OutstandingSettlement[] = [];
    const receivables: OutstandingSettlement[] = [];

    for (const row of expenses) {
      const original = new Decimal(String(row.amount));
      const settled = settledFor("PEMBAYARAN", "BEBAN", row.id);
      const outstanding = original.minus(settled);
      if (outstanding.lte(0)) continue;
      payables.push({
        direction: "PEMBAYARAN", targetType: "BEBAN", targetId: row.id,
        label: row.description, originDate: calendarDay(row.expenseDate),
        originalAmount: money(original), settledAmount: money(settled), outstandingAmount: money(outstanding),
        journalEntryId: null,
      });
    }

    for (const row of assets) {
      if (row.acquisitionJournalEntryId) {
        const original = new Decimal(String(row.acquisitionCost));
        const settled = settledFor("PEMBAYARAN", "ASET_TETAP", row.id);
        const outstanding = original.minus(settled);
        if (outstanding.gt(0)) {
          payables.push({
            direction: "PEMBAYARAN", targetType: "ASET_TETAP", targetId: row.id,
            label: row.name, originDate: calendarDay(row.acquisitionDate),
            originalAmount: money(original), settledAmount: money(settled), outstandingAmount: money(outstanding),
            journalEntryId: row.acquisitionJournalEntryId,
          });
        }
      }

      if (row.status === "DILEPAS" && row.disposalJournalEntryId && row.disposalProceeds) {
        const original = new Decimal(String(row.disposalProceeds));
        const settled = settledFor("PENERIMAAN", "ASET_TETAP", row.id);
        const outstanding = original.minus(settled);
        if (outstanding.gt(0)) {
          receivables.push({
            direction: "PENERIMAAN", targetType: "ASET_TETAP", targetId: row.id,
            label: row.name, originDate: row.disposalDate ? calendarDay(row.disposalDate) : calendarDay(row.acquisitionDate),
            originalAmount: money(original), settledAmount: money(settled), outstandingAmount: money(outstanding),
            journalEntryId: row.disposalJournalEntryId,
          });
        }
      }
    }

    return { payables, receivables };
  });
}

export type SettlementInput = {
  direction: SettlementDirection;
  targetType: SettlementTargetType;
  expenseId?: number;
  fixedAssetId?: number;
  amount: string;
  method: "KAS" | "BANK";
  /** Wajib untuk `KAS`. */
  currencyId?: number;
  /** Wajib untuk `BANK`. */
  bankAccountId?: number;
  settlementDate: string;
  notes: string;
  /** Wajib untuk `KAS` — aturan keras `CLAUDE.md` atas setiap pergerakan kas fisik. */
  denominations: DenominationEntryInput[];
};

export async function recordSettlement(input: SettlementInput, actor: { id: number; role: StaffRole }) {
  const amount = nonNegativeOrZeroDecimal(input.amount, "Jumlah pelunasan");
  if (amount.lte(0)) throw new Error("Jumlah pelunasan harus lebih besar dari nol.");
  const notes = input.notes.trim();
  if (notes.length < 5) throw new Error("Catatan wajib diisi (minimal 5 karakter) untuk jejak audit.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.settlementDate)) throw new Error("Tanggal pelunasan harus berbentuk YYYY-MM-DD.");

  // Beban tidak pernah menjadi piutang: uang yang masuk atasnya adalah pengembalian, kejadian lain
  // yang tidak punya akun sendiri di sini dan tidak boleh ditebak.
  if (input.direction === "PENERIMAAN" && input.targetType !== "ASET_TETAP") {
    throw new Error("Penagihan piutang hanya berlaku atas hasil pelepasan aset tetap.");
  }
  if (input.targetType === "BEBAN" && !input.expenseId) throw new Error("Beban yang dilunasi harus dipilih.");
  if (input.targetType === "ASET_TETAP" && !input.fixedAssetId) throw new Error("Aset tetap yang dilunasi harus dipilih.");

  const targetId = (input.targetType === "BEBAN" ? input.expenseId : input.fixedAssetId)!;
  const { payables, receivables } = await listOutstandingSettlements();
  const pool = input.direction === "PEMBAYARAN" ? payables : receivables;
  const target = pool.find((row) => row.targetType === input.targetType && row.targetId === targetId);
  if (!target) {
    throw new Error(
      input.direction === "PEMBAYARAN"
        ? "Tidak ada sisa tagihan atas pilihan itu. Kewajibannya sudah lunas, atau belum pernah terbentuk."
        : "Tidak ada sisa piutang atas pilihan itu.",
    );
  }
  const outstanding = new Decimal(target.outstandingAmount);
  if (amount.gt(outstanding)) {
    throw new Error(`Jumlah pelunasan melebihi sisa tagihan (${outstanding.toFixed(2)}). Membayar lebih daripada yang terutang berarti salah satu angkanya keliru.`);
  }

  const category = input.direction === "PEMBAYARAN" ? "KEWAJIBAN_DIBAYAR" : "PIUTANG_DITERIMA";
  const direction: "IN" | "OUT" = input.direction === "PEMBAYARAN" ? "OUT" : "IN";
  const db = await databaseOrThrow();

  if (input.method === "KAS") {
    if (!input.currencyId) throw new Error("Mata uang kas harus dipilih.");
    if (!input.denominations?.length) throw new Error("Rincian pecahan wajib diisi untuk pelunasan tunai.");

    const currency = (await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.id, input.currencyId)).limit(1))[0];
    if (!currency) throw new Error("Mata uang tidak ditemukan.");
    // Kas fisik valuta asing adalah persediaan yang dinilai pada akhir periode, bukan alat bayar —
    // alasan yang sama persis dengan penolakan setoran modal valuta asing.
    if (String(currency.code).trim().toUpperCase() !== "IDR") throw new Error("Pelunasan tunai hanya dapat dicatat dalam Rupiah.");
    const denominationRows = reconcileDenominations(input.denominations, amount, String(currency.code));

    return db.transaction(async (tx) => {
      const applied = await applyCashMovement(tx, {
        currencyId: input.currencyId!, direction, amount, category,
        reason: `${category}: ${notes}`, denominationRows, actorUserId: actor.id,
      });
      await tx.insert(ledgerSettlements).values({
        settlementDate: dbDate(input.settlementDate),
        direction: input.direction, targetType: input.targetType,
        expenseId: input.targetType === "BEBAN" ? targetId : null,
        fixedAssetId: input.targetType === "ASET_TETAP" ? targetId : null,
        amount: amount.toFixed(2), cashMovementId: applied.movementId, bankMovementId: null,
        notes: notes.slice(0, 500), createdByUserId: actor.id,
      });
      await writeAudit({
        actorUserId: actor.id, action: "SETTLEMENT_RECORDED", entityType: "ledger_settlements", entityId: String(targetId),
        beforeState: { outstanding: target.outstandingAmount }, afterState: { outstanding: outstanding.minus(amount).toFixed(2), cash: applied.after },
        reason: notes,
        metadata: { direction: input.direction, targetType: input.targetType, method: "KAS", amount: amount.toFixed(2), denominationCount: denominationRows.length },
      });
      return { targetType: input.targetType, targetId, amount: amount.toFixed(2), outstandingAfter: outstanding.minus(amount).toFixed(2), cashAfter: applied.after };
    });
  }

  if (!input.bankAccountId) throw new Error("Rekening yang dipakai harus dipilih.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${bankAccounts.id} FROM ${bankAccounts} WHERE ${bankAccounts.id} = ${input.bankAccountId} FOR UPDATE`);
    const account = (await tx.select().from(bankAccounts).where(and(eq(bankAccounts.id, input.bankAccountId!))).limit(1))[0];
    if (!account) throw new Error("Rekening bank tidak ditemukan.");

    const before = new Decimal(String(account.availableAmount));
    if (direction === "OUT" && before.lt(amount)) throw new Error("Jumlah pelunasan melebihi saldo rekening yang tersedia.");
    const after = direction === "OUT" ? before.minus(amount) : before.plus(amount);

    await tx.update(bankAccounts).set({ availableAmount: after.toFixed(6) }).where(eq(bankAccounts.id, account.id));
    const [movement] = await tx.insert(bankAccountMovements).values({
      bankAccountId: account.id, direction, amount: amount.toFixed(6),
      reason: `${category}: ${notes}`.slice(0, 255), category, createdByUserId: actor.id,
    }).$returningId();

    await tx.insert(ledgerSettlements).values({
      settlementDate: dbDate(input.settlementDate),
      direction: input.direction, targetType: input.targetType,
      expenseId: input.targetType === "BEBAN" ? targetId : null,
      fixedAssetId: input.targetType === "ASET_TETAP" ? targetId : null,
      amount: amount.toFixed(2), cashMovementId: null, bankMovementId: movement?.id ?? null,
      notes: notes.slice(0, 500), createdByUserId: actor.id,
    });
    await writeAudit({
      actorUserId: actor.id, action: "SETTLEMENT_RECORDED", entityType: "ledger_settlements", entityId: String(targetId),
      beforeState: { outstanding: target.outstandingAmount, bank: before.toFixed(6) },
      afterState: { outstanding: outstanding.minus(amount).toFixed(2), bank: after.toFixed(6) },
      reason: notes,
      metadata: { direction: input.direction, targetType: input.targetType, method: "BANK", bankAccountId: account.id, amount: amount.toFixed(2) },
    });
    return { targetType: input.targetType, targetId, amount: amount.toFixed(2), outstandingAfter: outstanding.minus(amount).toFixed(2), bankAfter: after.toFixed(6) };
  });
}
