/**
 * Register aset tetap dan penyusutannya.
 *
 * Baris Penyusutan pada form B0003 tidak punya asal sampai modul ini ada: akun 1-1510, 1-1520, dan
 * 6-1700 sudah berdiri di bagan akun dengan isi nol, dan `journalSourceTypes` sudah menyediakan
 * `PENYUSUTAN` yang belum dipakai siapa pun.
 *
 * Modul ini **tidak pernah menyentuh sistem kas**. Perolehan bertemu uang lewat 2-1900 Kewajiban
 * Lain-Lain dan pelepasan lewat 1-1320 Piutang Lain-Lain, dengan alasan yang sudah tertulis pada
 * `EXPENSE_PAYABLE_ACCOUNT`: modul di luar sistem kas yang mengkredit 1-1110 membuat kas pada buku
 * besar berbeda dari `cash_balances` — persis ketidakcocokan yang menjadi temuan pemeriksaan
 * 7.2/7.3. Pelunasannya dijurnal terpisah saat uangnya benar-benar bergerak.
 *
 * Kelompok pajak DJP hanyalah **default berlabel**. SAK EP Bab 17 menuntut umur manfaat sebenarnya
 * yang ditinjau tahunan; memasang aturan pajak diam-diam sebagai kebijakan akuntansi adalah
 * kekeliruan yang menurun ke setiap pelanggan sekaligus.
 */

import Decimal from "decimal.js";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import {
  accountingPeriods,
  fixedAssetDepreciationEntries,
  fixedAssetSettings,
  fixedAssets,
  type fixedAssetCategories,
  type fixedAssetTaxGroups,
} from "../drizzle/schema";
import { depreciationSchedule, monthKey } from "../shared/depreciation";
import { isSkipped, mapFixedAssetAcquisition } from "../shared/journalMapping";
import { calendarDay } from "../shared/ledger";
import { postJournalEntry } from "./ledgerOperations";
import { databaseOrThrow, retryTransientDatabaseRead, writeAudit } from "./operations";

export type FixedAssetCategory = (typeof fixedAssetCategories)[number];
export type FixedAssetTaxGroup = (typeof fixedAssetTaxGroups)[number];

/**
 * Tanggal yang dikirim ke kolom `date`.
 *
 * Tengah malam **waktu lokal**, bukan UTC: mengirim `Date` tengah malam UTC dari mesin WIB
 * membuat batas rentang mundur satu hari dan baris tanggal batas hilang diam-diam. Itu bug paket
 * K1 yang sudah diperbaiki dan tidak boleh kembali.
 */
const dbDate = (value: string) => new Date(`${value}T00:00:00`);

/**
 * Umur manfaat menurut kelompok penyusutan DJP (PMK 72/2023).
 *
 * Nilainya hanya **mengisi** medan umur manfaat pada form; ia tidak pernah mengunci
 * `usefulLifeMonths`, dan aset yang umur manfaat sebenarnya berbeda tetap boleh menyimpang.
 */
export const TAX_GROUP_USEFUL_LIFE_MONTHS: Record<FixedAssetTaxGroup, number | null> = {
  KELOMPOK_1: 48,
  KELOMPOK_2: 96,
  KELOMPOK_3: 192,
  KELOMPOK_4: 240,
  BANGUNAN_PERMANEN: 240,
  BANGUNAN_NON_PERMANEN: 120,
  TIDAK_DISUSUTKAN: null,
};

const DEFAULT_CAPITALISATION_THRESHOLD_IDR = "1000000.00";

/** Rupiah dengan pemisah ribuan, untuk pesan galat yang dibaca manusia. */
const formatIdr = (value: string) => `Rp ${new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d)(?=.*\.))/g, ".")}`;

export async function getFixedAssetSettings(): Promise<{ capitalisationThresholdIdr: string }> {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const found = (await db.select().from(fixedAssetSettings).limit(1))[0];
    return { capitalisationThresholdIdr: found?.capitalisationThresholdIdr ?? DEFAULT_CAPITALISATION_THRESHOLD_IDR };
  });
}

export async function updateFixedAssetSettings(
  input: { capitalisationThresholdIdr: string },
  actor: { id: number },
) {
  const threshold = new Decimal(input.capitalisationThresholdIdr);
  if (!threshold.isFinite() || threshold.lessThanOrEqualTo(0)) {
    throw new Error("Batas kapitalisasi harus lebih besar dari nol.");
  }
  const normalized = threshold.toFixed(2);

  const db = await databaseOrThrow();
  const existing = (await db.select().from(fixedAssetSettings).limit(1))[0];
  if (existing) {
    await db
      .update(fixedAssetSettings)
      .set({ capitalisationThresholdIdr: normalized, updatedByUserId: actor.id })
      .where(eq(fixedAssetSettings.id, existing.id));
  } else {
    await db.insert(fixedAssetSettings).values({ capitalisationThresholdIdr: normalized, updatedByUserId: actor.id });
  }

  await writeAudit({
    actorUserId: actor.id,
    action: "FIXED_ASSET_SETTINGS_UPDATED",
    entityType: "fixed_asset_settings",
    entityId: "1",
    beforeState: { capitalisationThresholdIdr: existing?.capitalisationThresholdIdr ?? DEFAULT_CAPITALISATION_THRESHOLD_IDR },
    afterState: { capitalisationThresholdIdr: normalized },
  });
  return { capitalisationThresholdIdr: normalized };
}

export type RegisterFixedAssetInput = {
  assetCode?: string;
  name: string;
  category: FixedAssetCategory;
  taxGroup?: FixedAssetTaxGroup;
  /** "YYYY-MM-DD"; diubah ke kolom `date` lewat `dbDate`. */
  acquisitionDate: string;
  acquisitionCost: string;
  residualValue?: string;
  /** NULL hanya sah untuk kategori TANAH. */
  usefulLifeMonths: number | null;
  /** "YYYY-MM"; kosong berarti sama dengan bulan perolehan — aset yang baru dibeli. */
  firstJournalMonth?: string;
  openingAccumulatedDepreciation?: string;
  notes?: string;
};

/**
 * Mendaftarkan sebuah aset, dan — kecuali ia aset warisan — menjurnal perolehannya.
 *
 * Aset warisan (`firstJournalMonth` lebih akhir daripada bulan perolehan, atau akumulasi awal yang
 * bukan nol) sengaja **tidak** dijurnal: saldo 1-1510 dan 1-1520-nya masuk lewat jalur `SALDO_AWAL`
 * yang sudah ada, dan register tidak boleh menjadi modul kedua yang menulis saldo awal.
 */
export async function registerFixedAsset(input: RegisterFixedAssetInput, actor: { id: number }) {
  const acquisitionMonth = monthKey(input.acquisitionDate);
  const firstJournalMonth = input.firstJournalMonth ?? acquisitionMonth;
  const openingAccumulatedDepreciation = input.openingAccumulatedDepreciation ?? "0.00";
  const residualValue = input.residualValue ?? "0.00";
  const isLegacy = firstJournalMonth !== acquisitionMonth || new Decimal(openingAccumulatedDepreciation).greaterThan(0);

  if (input.category === "TANAH") {
    if (input.usefulLifeMonths !== null) {
      throw new Error("Tanah tidak disusutkan; kosongkan umur manfaatnya.");
    }
  } else if (input.usefulLifeMonths === null) {
    throw new Error("Umur manfaat wajib diisi untuk aset selain tanah.");
  }

  // Tanah dikecualikan dari batas: harganya tidak pernah di bawahnya, dan mengujinya hanya
  // menambah cabang yang tidak pernah benar.
  if (input.category !== "TANAH") {
    const { capitalisationThresholdIdr } = await getFixedAssetSettings();
    if (new Decimal(input.acquisitionCost).lessThan(capitalisationThresholdIdr)) {
      throw new Error(
        `Harga perolehan di bawah batas kapitalisasi ${formatIdr(capitalisationThresholdIdr)}; catat sebagai beban lewat Catat Pengeluaran.`,
      );
    }
  }

  // Divalidasi sekali di sini dengan memanggil jadwalnya; pesan galat `shared/depreciation.ts`
  // sudah menyebut sebabnya, dan menuliskan ulang aturannya di sini berarti dua salinan yang dapat
  // berbeda pendapat.
  depreciationSchedule({
    acquisitionMonth,
    firstJournalMonth,
    acquisitionCost: input.acquisitionCost,
    residualValue,
    usefulLifeMonths: input.usefulLifeMonths,
    openingAccumulatedDepreciation,
  });

  const db = await databaseOrThrow();

  // Periode tertutup ditolak **di muka** dengan menyebut jalan keluarnya. `postJournalEntry`
  // menolaknya sendiri, tetapi pesannya tidak menyebutkan bahwa aset yang perolehannya jatuh di
  // masa lalu memang seharusnya didaftarkan sebagai aset warisan.
  if (!isLegacy) {
    const period = (
      await db
        .select({ status: accountingPeriods.status })
        .from(accountingPeriods)
        .where(and(lte(accountingPeriods.periodStart, dbDate(input.acquisitionDate)), sql`${accountingPeriods.periodEnd} >= ${dbDate(input.acquisitionDate)}`))
        .limit(1)
    )[0];
    if (period?.status === "DITUTUP") {
      throw new Error(
        `Periode pembukuan ${acquisitionMonth} sudah ditutup, sehingga jurnal perolehannya tidak dapat ditulis. Daftarkan sebagai aset warisan beserta akumulasi penyusutannya.`,
      );
    }
  }

  const [inserted] = await db
    .insert(fixedAssets)
    .values({
      assetCode: input.assetCode?.trim() || null,
      name: input.name.trim(),
      category: input.category,
      taxGroup: input.taxGroup ?? null,
      acquisitionDate: dbDate(input.acquisitionDate),
      acquisitionCost: input.acquisitionCost,
      residualValue,
      usefulLifeMonths: input.usefulLifeMonths,
      firstJournalMonth,
      openingAccumulatedDepreciation,
      acquisitionJournalEntryId: null,
      notes: input.notes?.trim() || null,
      recordedByUserId: actor.id,
    })
    .$returningId();

  let entry: { id: number; entryNumber: string } | null = null;
  if (!isLegacy) {
    const mapped = mapFixedAssetAcquisition({ cost: input.acquisitionCost, assetName: input.name.trim() });
    if (!isSkipped(mapped)) {
      entry = await postJournalEntry(
        {
          entryDate: dbDate(input.acquisitionDate),
          description: `Perolehan ${input.name.trim()}`.slice(0, 500),
          sourceType: "PEROLEHAN_ASET",
          sourceReference: `ASET-${inserted.id}`,
          lines: mapped.lines,
        },
        actor,
      );
      await db
        .update(fixedAssets)
        .set({ acquisitionJournalEntryId: entry.id })
        .where(eq(fixedAssets.id, inserted.id));
    }
  }

  await writeAudit({
    actorUserId: actor.id,
    action: "FIXED_ASSET_REGISTERED",
    entityType: "fixed_assets",
    entityId: String(inserted.id),
    afterState: {
      name: input.name.trim(),
      category: input.category,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      residualValue,
      usefulLifeMonths: input.usefulLifeMonths,
      firstJournalMonth,
      openingAccumulatedDepreciation,
      isLegacy,
      entryNumber: entry?.entryNumber ?? null,
    },
    reason: isLegacy ? "aset warisan; saldo awalnya masuk lewat jalur SALDO_AWAL, bukan dari register" : null,
  });

  return { id: inserted.id, entryNumber: entry?.entryNumber ?? null };
}

export type FixedAssetRow = {
  id: number;
  assetCode: string | null;
  name: string;
  category: FixedAssetCategory;
  taxGroup: FixedAssetTaxGroup | null;
  acquisitionDate: string;
  acquisitionCost: string;
  residualValue: string;
  usefulLifeMonths: number | null;
  firstJournalMonth: string;
  openingAccumulatedDepreciation: string;
  /** Akumulasi awal ditambah seluruh beban yang **sudah dijurnal** — bukan jadwal teoretisnya. */
  accumulated: string;
  carrying: string;
  status: "AKTIF" | "DILEPAS";
  disposalDate: string | null;
  disposalProceeds: string | null;
  isLegacy: boolean;
};

export async function listFixedAssets(): Promise<FixedAssetRow[]> {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const rows = await db
      .select({
        id: fixedAssets.id,
        assetCode: fixedAssets.assetCode,
        name: fixedAssets.name,
        category: fixedAssets.category,
        taxGroup: fixedAssets.taxGroup,
        acquisitionDate: fixedAssets.acquisitionDate,
        acquisitionCost: fixedAssets.acquisitionCost,
        residualValue: fixedAssets.residualValue,
        usefulLifeMonths: fixedAssets.usefulLifeMonths,
        firstJournalMonth: fixedAssets.firstJournalMonth,
        openingAccumulatedDepreciation: fixedAssets.openingAccumulatedDepreciation,
        acquisitionJournalEntryId: fixedAssets.acquisitionJournalEntryId,
        status: fixedAssets.status,
        disposalDate: fixedAssets.disposalDate,
        disposalProceeds: fixedAssets.disposalProceeds,
        postedCharge: sql<string | null>`SUM(${fixedAssetDepreciationEntries.charge})`,
      })
      .from(fixedAssets)
      .leftJoin(fixedAssetDepreciationEntries, eq(fixedAssetDepreciationEntries.assetId, fixedAssets.id))
      .groupBy(fixedAssets.id)
      .orderBy(desc(fixedAssets.acquisitionDate), desc(fixedAssets.id));

    return rows.map((row) => {
      const accumulated = new Decimal(row.openingAccumulatedDepreciation).plus(row.postedCharge ?? "0");
      return {
        id: row.id,
        assetCode: row.assetCode,
        name: row.name,
        category: row.category,
        taxGroup: row.taxGroup,
        acquisitionDate: calendarDay(row.acquisitionDate),
        acquisitionCost: row.acquisitionCost,
        residualValue: row.residualValue,
        usefulLifeMonths: row.usefulLifeMonths,
        firstJournalMonth: row.firstJournalMonth,
        openingAccumulatedDepreciation: row.openingAccumulatedDepreciation,
        accumulated: accumulated.toFixed(2),
        carrying: new Decimal(row.acquisitionCost).minus(accumulated).toFixed(2),
        status: row.status,
        disposalDate: row.disposalDate ? calendarDay(row.disposalDate) : null,
        disposalProceeds: row.disposalProceeds,
        isLegacy: row.acquisitionJournalEntryId === null,
      };
    });
  });
}
