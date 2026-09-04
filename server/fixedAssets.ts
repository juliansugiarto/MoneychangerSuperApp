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
  journalEntries,
  type fixedAssetCategories,
  type fixedAssetTaxGroups,
} from "../drizzle/schema";
import { depreciationForMonth, depreciationSchedule, monthKey } from "../shared/depreciation";
import {
  isSkipped,
  mapFixedAssetAcquisition,
  mapFixedAssetDisposal,
  mapMonthlyDepreciation,
} from "../shared/journalMapping";
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

export type AssetDepreciationRow = {
  assetId: number;
  assetCode: string | null;
  assetName: string;
  category: FixedAssetCategory;
  charge: string;
  accumulatedAfter: string;
  carryingAfter: string;
};

export type MonthlyDepreciation = {
  periodId: number;
  /** "YYYY-MM" bulan periode itu. */
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  status: "TERBUKA" | "DITUTUP";
  rows: AssetDepreciationRow[];
  totalCharge: string;
  blockers: { assetName: string; reason: string }[];
  depreciationPostedAt: Date | null;
};

/**
 * Beban penyusutan sebuah periode beserta apa yang menghalanginya. **Tidak menulis apa pun.**
 *
 * Panel memakainya untuk menunjukkan angka sebelum tombol ditekan, dan `postMonthlyDepreciation`
 * memakainya sebagai satu-satunya sumber angka — sehingga yang dilihat pengguna dan yang dijurnal
 * server mustahil berbeda. Pola yang sama dengan `buildPeriodValuation` pada paket C.
 *
 * Aset yang bulan itu **sudah** punya baris keluar sebagai penghalang, bukan sebagai baris:
 * menjalankan penyusutan dua kali tidak boleh menjurnal beban yang sama untuk kedua kalinya, dan
 * kunci unik `(assetId, periodMonth)` adalah jaring terakhirnya, bukan yang pertama.
 */
export async function buildMonthlyDepreciation(periodId: number): Promise<MonthlyDepreciation> {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();

    const period = (
      await db
        .select({
          id: accountingPeriods.id,
          periodStart: accountingPeriods.periodStart,
          periodEnd: accountingPeriods.periodEnd,
          status: accountingPeriods.status,
          depreciationPostedAt: accountingPeriods.depreciationPostedAt,
        })
        .from(accountingPeriods)
        .where(eq(accountingPeriods.id, periodId))
        .limit(1)
    )[0];
    if (!period) {
      const error = new Error(`Periode ${periodId} tidak ditemukan.`) as Error & { code?: string };
      error.code = "PERIOD_NOT_FOUND";
      throw error;
    }

    const periodMonth = monthKey(period.periodStart);

    const assets = await db
      .select({
        id: fixedAssets.id,
        assetCode: fixedAssets.assetCode,
        name: fixedAssets.name,
        category: fixedAssets.category,
        // Wajib ikut dibaca: untuk aset warisan, bulan perolehan dan bulan jurnal pertama berbeda,
        // dan selisih itulah yang menentukan berapa bulan umur manfaatnya masih tersisa. Memakai
        // `firstJournalMonth` sebagai bulan perolehan akan membagi sisa dasar penyusutan atas umur
        // manfaat **penuh**, sehingga bebannya terlalu kecil dan asetnya tidak pernah habis
        // disusutkan pada waktunya.
        acquisitionDate: fixedAssets.acquisitionDate,
        acquisitionCost: fixedAssets.acquisitionCost,
        residualValue: fixedAssets.residualValue,
        usefulLifeMonths: fixedAssets.usefulLifeMonths,
        firstJournalMonth: fixedAssets.firstJournalMonth,
        openingAccumulatedDepreciation: fixedAssets.openingAccumulatedDepreciation,
        status: fixedAssets.status,
        disposalDate: fixedAssets.disposalDate,
      })
      .from(fixedAssets)
      .orderBy(fixedAssets.id);

    const entries = await db
      .select({
        assetId: fixedAssetDepreciationEntries.assetId,
        periodMonth: fixedAssetDepreciationEntries.periodMonth,
        charge: fixedAssetDepreciationEntries.charge,
      })
      .from(fixedAssetDepreciationEntries);

    const rows: AssetDepreciationRow[] = [];
    const blockers: { assetName: string; reason: string }[] = [];
    let totalCharge = new Decimal(0);

    for (const asset of assets) {
      // Tanah tidak menyusut, dan itu bukan kekurangan data — ia tidak boleh muncul sebagai
      // penghalang yang menahan penutupan periode.
      if (asset.usefulLifeMonths === null) continue;

      // Aset yang dilepas **di dalam** bulan ini tetap disusutkan: pelepasan menuntut penyusutan
      // sampai dengan bulan pelepasan sudah dijurnal lebih dulu.
      if (asset.status === "DILEPAS" && asset.disposalDate && monthKey(asset.disposalDate) < periodMonth) continue;

      const assetEntries = entries.filter((entry) => entry.assetId === asset.id);
      if (assetEntries.some((entry) => entry.periodMonth === periodMonth)) {
        blockers.push({ assetName: asset.name, reason: `penyusutan bulan ${periodMonth} sudah dijurnal` });
        continue;
      }

      const charge = depreciationForMonth(
        {
          acquisitionMonth: monthKey(asset.acquisitionDate),
          firstJournalMonth: asset.firstJournalMonth,
          acquisitionCost: asset.acquisitionCost,
          residualValue: asset.residualValue,
          usefulLifeMonths: asset.usefulLifeMonths,
          openingAccumulatedDepreciation: asset.openingAccumulatedDepreciation,
        },
        periodMonth,
      );
      if (new Decimal(charge).lessThanOrEqualTo(0)) continue;

      // Akumulasi dihitung dari baris yang **sudah dijurnal**, bukan dari jadwalnya: bulan yang
      // belum dijurnal belum pernah menyentuh 1-1520.
      const postedBefore = assetEntries.reduce((sum, entry) => sum.plus(entry.charge), new Decimal(0));
      const accumulatedAfter = new Decimal(asset.openingAccumulatedDepreciation).plus(postedBefore).plus(charge);

      rows.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.name,
        category: asset.category,
        charge,
        accumulatedAfter: accumulatedAfter.toFixed(2),
        carryingAfter: new Decimal(asset.acquisitionCost).minus(accumulatedAfter).toFixed(2),
      });
      totalCharge = totalCharge.plus(charge);
    }

    return {
      periodId,
      periodMonth,
      periodStart: calendarDay(period.periodStart),
      periodEnd: calendarDay(period.periodEnd),
      status: period.status,
      rows,
      totalCharge: totalCharge.toFixed(2),
      blockers,
      depreciationPostedAt: period.depreciationPostedAt,
    };
  });
}

export const monthlyDepreciationSourceReference = (periodMonth: string) => `SUSUT-${periodMonth}`;

/**
 * Menjurnal penyusutan sebuah bulan: menulis rinciannya, jurnalnya, dan menandai periodenya.
 *
 * Angkanya tidak dihitung ulang di sini — seluruhnya datang dari `buildMonthlyDepreciation`, yang
 * juga dipakai panel untuk menampilkannya sebelum tombol ditekan. Itu membuat angka yang dilihat
 * pengguna dan angka yang dijurnal server mustahil berbeda.
 *
 * Penyusutan tidak pernah berjalan sebagian: satu penghalang saja membatalkan seluruhnya. Buku
 * besar yang setengah disusutkan jauh lebih sulit ditelusuri daripada yang belum disusutkan.
 */
export async function postMonthlyDepreciation(input: { periodId: number }, actor: { id: number }) {
  const plan = await buildMonthlyDepreciation(input.periodId);
  if (plan.status === "DITUTUP") {
    throw new Error("Periode ini sudah ditutup; penyusutannya tidak dapat dijalankan lagi.");
  }
  if (plan.depreciationPostedAt) {
    throw new Error(
      "Penyusutan periode ini sudah dijalankan; balik jurnalnya lebih dulu bila angkanya perlu diperbaiki.",
    );
  }
  if (plan.blockers.length) {
    const detail = plan.blockers.map((blocker) => `${blocker.assetName} (${blocker.reason})`).join(", ");
    throw new Error(`Penyusutan tidak dapat dijalankan: ${detail}.`);
  }

  const db = await databaseOrThrow();
  const sourceReference = monthlyDepreciationSourceReference(plan.periodMonth);
  const mapped = mapMonthlyDepreciation({ totalCharge: plan.totalCharge, month: plan.periodMonth });

  let entry: { id: number; entryNumber: string } | null = null;
  if (!isSkipped(mapped)) {
    // Percobaan sebelumnya boleh saja gagal setelah jurnalnya tertulis tetapi sebelum penanda
    // periodenya tersimpan. Memakai ulang jurnal itu memulihkan keadaan tersebut; menulis yang
    // kedua hanya akan menabrak kunci unik dan mengunci bulan itu selamanya.
    const existing = (
      await db
        .select({ id: journalEntries.id, entryNumber: journalEntries.entryNumber })
        .from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "PENYUSUTAN"), eq(journalEntries.sourceReference, sourceReference)))
        .limit(1)
    )[0];
    entry =
      existing ??
      (await postJournalEntry(
        {
          entryDate: dbDate(plan.periodEnd),
          description: `Penyusutan aset tetap ${plan.periodMonth}`,
          sourceType: "PENYUSUTAN",
          sourceReference,
          lines: mapped.lines,
        },
        actor,
      ));
  }

  const postedAt = new Date();
  // Baris rincian dan penanda periodenya harus jatuh bersama. Baris tanpa penanda membuat
  // penyusutan tampak belum berjalan padahal jurnalnya sudah ada; penanda tanpa baris membuat
  // beban 6-1700 kehilangan bukti per asetnya — persis yang temuan 7.1 permasalahkan.
  await db.transaction(async (tx) => {
    if (plan.rows.length && entry) {
      await tx.insert(fixedAssetDepreciationEntries).values(
        plan.rows.map((row) => ({
          assetId: row.assetId,
          periodMonth: plan.periodMonth,
          periodId: plan.periodId,
          charge: row.charge,
          accumulatedAfter: row.accumulatedAfter,
          carryingAfter: row.carryingAfter,
          journalEntryId: entry.id,
        })),
      );
    }
    await tx
      .update(accountingPeriods)
      .set({ depreciationPostedAt: postedAt, depreciationJournalEntryId: entry?.id ?? null })
      .where(eq(accountingPeriods.id, input.periodId));
  });

  await writeAudit({
    actorUserId: actor.id,
    action: "MONTHLY_DEPRECIATION_POSTED",
    entityType: "accounting_periods",
    entityId: String(input.periodId),
    afterState: {
      periodMonth: plan.periodMonth,
      entryNumber: entry?.entryNumber ?? null,
      totalCharge: plan.totalCharge,
      assets: plan.rows.map((row) => ({
        assetId: row.assetId,
        assetName: row.assetName,
        charge: row.charge,
        accumulatedAfter: row.accumulatedAfter,
      })),
    },
    reason: isSkipped(mapped) ? mapped.skipped : null,
  });

  return {
    periodId: input.periodId,
    entryNumber: entry?.entryNumber ?? null,
    rows: plan.rows,
    skipped: isSkipped(mapped) ? mapped.skipped : null,
  };
}

/**
 * Melepaskan sebuah aset: mengeluarkan harga perolehan dan akumulasinya dari neraca, dan
 * menjatuhkan selisihnya terhadap hasil pelepasan ke 7-1400.
 *
 * Hasil pelepasan masuk ke 1-1320 Piutang Lain-Lain, bukan ke kas — alasan yang sama seperti
 * perolehan. Pelunasannya dijurnal terpisah saat uangnya benar-benar diterima.
 *
 * Akumulasi yang dikeluarkan adalah yang **benar-benar tercatat**: akumulasi awal ditambah baris
 * `fixed_asset_depreciation_entries`. Karena itu pelepasan menolak aset yang penyusutannya belum
 * dijurnal sampai dengan bulan pelepasan — mengeluarkan dari 1-1520 lebih banyak daripada yang
 * pernah masuk membuat neracanya tetap seimbang sementara angkanya salah.
 */
export async function disposeFixedAsset(
  input: { assetId: number; disposalDate: string; proceeds: string; notes?: string },
  actor: { id: number },
) {
  const db = await databaseOrThrow();

  const asset = (
    await db
      .select({
        id: fixedAssets.id,
        name: fixedAssets.name,
        acquisitionDate: fixedAssets.acquisitionDate,
        acquisitionCost: fixedAssets.acquisitionCost,
        residualValue: fixedAssets.residualValue,
        usefulLifeMonths: fixedAssets.usefulLifeMonths,
        firstJournalMonth: fixedAssets.firstJournalMonth,
        openingAccumulatedDepreciation: fixedAssets.openingAccumulatedDepreciation,
        status: fixedAssets.status,
      })
      .from(fixedAssets)
      .where(eq(fixedAssets.id, input.assetId))
      .limit(1)
  )[0];
  if (!asset) throw new Error(`Aset ${input.assetId} tidak ditemukan.`);
  if (asset.status === "DILEPAS") throw new Error("Aset ini sudah dilepas.");

  const acquisitionDay = calendarDay(asset.acquisitionDate);
  if (input.disposalDate < acquisitionDay) {
    throw new Error(`Tanggal pelepasan ${input.disposalDate} mendahului tanggal perolehan ${acquisitionDay}.`);
  }

  const disposalMonth = monthKey(input.disposalDate);
  const entries = await db
    .select({
      assetId: fixedAssetDepreciationEntries.assetId,
      periodMonth: fixedAssetDepreciationEntries.periodMonth,
      charge: fixedAssetDepreciationEntries.charge,
    })
    .from(fixedAssetDepreciationEntries)
    .where(eq(fixedAssetDepreciationEntries.assetId, input.assetId));

  // Bulan yang seharusnya sudah dijurnal tetapi belum. Tanah tidak pernah punya satu pun, dan itu
  // benar — ia tidak menyusut, jadi tidak ada yang tertinggal.
  if (asset.usefulLifeMonths !== null) {
    const posted = new Set(entries.map((entry) => entry.periodMonth));
    const schedule = depreciationSchedule({
      acquisitionMonth: monthKey(asset.acquisitionDate),
      firstJournalMonth: asset.firstJournalMonth,
      acquisitionCost: asset.acquisitionCost,
      residualValue: asset.residualValue,
      usefulLifeMonths: asset.usefulLifeMonths,
      openingAccumulatedDepreciation: asset.openingAccumulatedDepreciation,
    });
    const missing = schedule
      .filter((row) => row.month <= disposalMonth && !posted.has(row.month))
      .map((row) => row.month);
    if (missing.length) {
      throw new Error(
        `Penyusutan aset ini belum dijurnal untuk ${missing.join(", ")}; jalankan penyusutan bulan-bulan itu lebih dulu.`,
      );
    }
  }

  const period = (
    await db
      .select({ status: accountingPeriods.status })
      .from(accountingPeriods)
      .where(
        and(
          lte(accountingPeriods.periodStart, dbDate(input.disposalDate)),
          sql`${accountingPeriods.periodEnd} >= ${dbDate(input.disposalDate)}`,
        ),
      )
      .limit(1)
  )[0];
  if (period?.status === "DITUTUP") {
    throw new Error(
      `Periode pembukuan ${disposalMonth} sudah ditutup, sehingga jurnal pelepasannya tidak dapat ditulis.`,
    );
  }

  const accumulated = entries
    .reduce((sum, entry) => sum.plus(entry.charge), new Decimal(asset.openingAccumulatedDepreciation))
    .toFixed(2);
  const carryingAmount = new Decimal(asset.acquisitionCost).minus(accumulated).toFixed(2);
  const gainLoss = new Decimal(input.proceeds).minus(carryingAmount).toFixed(2);

  const mapped = mapFixedAssetDisposal({
    cost: asset.acquisitionCost,
    accumulated,
    proceeds: input.proceeds,
    assetName: asset.name,
  });
  // Pelepasan yang tidak dapat dipetakan tidak boleh diam-diam berhasil: asetnya akan tampak lepas
  // sementara 1-1510 dan 1-1520 masih memuatnya.
  if (isSkipped(mapped)) throw new Error(`Pelepasan tidak dapat dijurnal: ${mapped.skipped}.`);

  const entry = await postJournalEntry(
    {
      entryDate: dbDate(input.disposalDate),
      description: `Pelepasan ${asset.name}`.slice(0, 500),
      sourceType: "PELEPASAN_ASET",
      sourceReference: `LEPAS-${input.assetId}`,
      lines: mapped.lines,
    },
    actor,
  );

  await db
    .update(fixedAssets)
    .set({
      status: "DILEPAS",
      disposalDate: dbDate(input.disposalDate),
      disposalProceeds: input.proceeds,
      disposalJournalEntryId: entry.id,
      disposalNotes: input.notes?.trim() || null,
    })
    .where(eq(fixedAssets.id, input.assetId));

  await writeAudit({
    actorUserId: actor.id,
    action: "FIXED_ASSET_DISPOSED",
    entityType: "fixed_assets",
    entityId: String(input.assetId),
    beforeState: { status: "AKTIF" },
    afterState: {
      disposalDate: input.disposalDate,
      proceeds: input.proceeds,
      accumulated,
      carryingAmount,
      gainLoss,
      entryNumber: entry.entryNumber,
    },
  });

  return { assetId: input.assetId, entryNumber: entry.entryNumber, gainLoss };
}
