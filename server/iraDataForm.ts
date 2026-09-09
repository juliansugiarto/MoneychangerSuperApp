import Decimal from "decimal.js";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import {
  ACCUMULATED_TRANSACTION_STATUSES,
  currencies,
  customers,
  exchangeTransactionLines,
  exchangeTransactions,
  iraRiskTypes,
  type IraRiskLevel,
  type IraRiskType,
} from "../drizzle/schema";
import {
  IRA_DISTRIBUTION_CHANNELS,
  IRA_LEGAL_FORMS,
  IRA_OCCUPATION_CATEGORIES,
  type IraDistributionChannel,
  type IraLegalForm,
  type IraOccupationCategory,
} from "../shared/iraVocabulary";
import { classificationKey } from "./iraRiskClassification";
import { databaseOrThrow } from "./operations";

/**
 * Agregat Form C1 — komposisi **seluruh lembaga selama satu periode penilaian**.
 *
 * Pertanyaan yang berbeda dari `readMonthlyCustomerActivity` (Paket H), yang menjawab aktivitas
 * **satu nasabah pada satu bulan**. Yang dipakai ulang bukan kodenya melainkan keputusannya:
 * `ACCUMULATED_TRANSACTION_STATUSES` sebagai satu-satunya daftar status, dan helper jendela
 * operasional sebagai satu-satunya cara membentuk batas periode.
 *
 * Lipatannya murni dan diuji tanpa basis data; querynya tipis dan hanya mengumpulkan barisnya.
 */

/** Satu baris hasil query: satu transaksi × satu mata uang. */
export type IraTransactionRow = {
  /** `LINE` datang dari `exchange_transaction_lines`; `LEGACY` dari kolom `currencyId` pada bonnya. */
  source: "LINE" | "LEGACY";
  transactionId: number;
  /** Nilai **bonnya**, bukan nilai barisnya. Dipakai untuk total dan hitungan, tidak untuk per mata uang. */
  bonRupiahAmount: string;
  /** Nilai barisnya; `null` pada baris LEGACY. */
  lineRupiahAmount: string | null;
  currencyCode: string | null;
  distributionChannel: IraDistributionChannel;
  /** Kewarganegaraan nasabahnya, ISO alpha-2. */
  nationality: string | null;
};

export type IraCustomerRow = {
  id: number;
  customerType: "INDIVIDU" | "BADAN_USAHA" | null;
  entityLegalForm: IraLegalForm | null;
  occupationCategory: IraOccupationCategory | null;
  pepStatus: "NONE" | "SELF" | "RELATED";
  /** Kewarganegaraan, ISO alpha-2. Dipakai parameter PPSPM yang bertanya tentang **nasabahnya**. */
  nationality: string | null;
};

const NOL = "0.00";

/** Persentase dua desimal; penyebut nol menghasilkan "0.00", bukan NaN maupun galat pembagian. */
function share(part: Decimal, whole: Decimal): string {
  if (whole.isZero()) return NOL;
  return part.dividedBy(whole).times(100).toFixed(2);
}

export type IraTransactionComposition = {
  transactionCount: number;
  totalRupiah: string;
  currencyTurnover: { code: string; rupiah: string; sharePercent: string }[];
  distributionChannels: { channel: IraDistributionChannel; transactionCount: number; sharePercent: string }[];
  highRiskCountry: { riskType: IraRiskType; transactionCount: number; rupiah: string }[];
};

/**
 * Melipat baris transaksi menjadi komposisi seperiode. Murni.
 *
 * **Jebakan bon berbaris banyak.** `bonRupiahAmount` adalah nilai bonnya; menjumlahkan hasil join
 * baris apa adanya menghitung bon yang sama berkali-kali — kekeliruan yang sudah pernah terjadi
 * pada `foldMonthlyActivity` Paket H. Karena itu total, hitungan bon, jalur distribusi, dan nominal
 * negara berisiko semuanya dihitung **per `transactionId`**, sementara omzet per mata uang justru
 * datang dari `lineRupiahAmount`.
 *
 * Bon yang punya baris memakai barisnya; bon lama bermata uang tunggal yang tidak punya baris sama
 * sekali memakai nilai bonnya. Baris LEGACY milik bon berbaris banyak berkode mata uang kosong dan
 * tidak ikut, sehingga bonnya tidak dihitung dua kali.
 */
export function foldTransactionComposition(
  rows: IraTransactionRow[],
  countryLevels: ReadonlyMap<string, IraRiskLevel>,
): IraTransactionComposition {
  const bons = new Map<number, { rupiah: Decimal; channel: IraDistributionChannel; nationality: string | null; hasLines: boolean }>();
  for (const row of rows) {
    let bon = bons.get(row.transactionId);
    if (!bon) {
      bon = { rupiah: new Decimal(row.bonRupiahAmount), channel: row.distributionChannel, nationality: row.nationality, hasLines: false };
      bons.set(row.transactionId, bon);
    }
    if (row.source === "LINE") bon.hasLines = true;
  }

  const perCurrency = new Map<string, Decimal>();
  for (const row of rows) {
    const bon = bons.get(row.transactionId)!;
    // Bon berbaris banyak memakai barisnya; barisan LEGACY-nya dilewati agar tidak berganda.
    if (bon.hasLines && row.source !== "LINE") continue;
    const code = row.currencyCode?.trim().toUpperCase();
    if (!code) continue;
    const amount = new Decimal(row.lineRupiahAmount ?? row.bonRupiahAmount);
    perCurrency.set(code, (perCurrency.get(code) ?? new Decimal(0)).plus(amount));
  }

  const totalRupiah = [...bons.values()].reduce((sum, bon) => sum.plus(bon.rupiah), new Decimal(0));

  const currencyTurnover = [...perCurrency]
    .sort((left, right) => right[1].comparedTo(left[1]) || left[0].localeCompare(right[0]))
    .map(([code, rupiah]) => ({ code, rupiah: rupiah.toFixed(2), sharePercent: share(rupiah, totalRupiah) }));

  const bonCount = new Decimal(bons.size);
  // Ketiga jalur selalu muncul, termasuk yang nol: jalur yang tidak dipakai periode ini tetap satu
  // baris pada formulirnya, dan baris yang hilang terbaca sebagai pertanyaan yang tidak dijawab.
  const distributionChannels = IRA_DISTRIBUTION_CHANNELS.map((channel) => {
    const count = [...bons.values()].filter((bon) => bon.channel === channel).length;
    return { channel, transactionCount: count, sharePercent: share(new Decimal(count), bonCount) };
  });

  const highRiskCountry = iraRiskTypes.map((riskType) => {
    const matching = [...bons.values()].filter((bon) => {
      const code = bon.nationality?.trim().toUpperCase();
      return Boolean(code) && countryLevels.get(classificationKey("COUNTRY", code!, riskType)) === "TINGGI";
    });
    return {
      riskType,
      transactionCount: matching.length,
      rupiah: matching.reduce((sum, bon) => sum.plus(bon.rupiah), new Decimal(0)).toFixed(2),
    };
  });

  return { transactionCount: bons.size, totalRupiah: totalRupiah.toFixed(2), currencyTurnover, distributionChannels, highRiskCountry };
}

export type IraCustomerComposition = {
  customersTotal: number;
  /** Belum dinyatakan perorangan atau badan usaha — pekerjaan yang menunggu, bukan keadaan sah. */
  customersWithoutCustomerType: number;
  customersWithoutOccupationCategory: number;
  customersWithoutLegalForm: number;
  /** Penyebut persentase profesi: nasabah **berkategori** saja. Dikembalikan agar dapat dinyatakan. */
  occupationDenominator: number;
  legalFormDenominator: number;
  occupationCategories: { code: IraOccupationCategory; customerCount: number; sharePercent: string }[];
  legalForms: { code: IraLegalForm; customerCount: number; sharePercent: string }[];
  pepCustomerCount: number;
  /** Belum diisi kewarganegaraannya — penyebut persentase negara berisiko mengecualikannya. */
  customersWithoutNationality: number;
  /** Penyebut persentase negara berisiko: nasabah yang kewarganegaraannya diketahui. */
  nationalityDenominator: number;
  /**
   * Nasabah **bukan badan usaha** yang berkewarganegaraan negara berisiko TINGGI menurut
   * klasifikasi `COUNTRY`, per jenis risiko.
   *
   * Berbeda dari `highRiskCountry`, yang menghitung **transaksinya**. Parameter `PPSPM_3A`
   * bertanya tentang komposisi *pengguna jasa*, bukan komposisi transaksi, dan menjawabnya dengan
   * angka transaksi akan menggeser persentasenya sebanyak nasabah yang bertransaksi berulang.
   */
  highRiskCountryCustomers: { riskType: IraRiskType; customerCount: number; sharePercent: string }[];
};

/**
 * Melipat baris nasabah menjadi komposisi profesi dan bentuk badan hukum. Murni.
 *
 * Persentasenya dihitung atas nasabah **berkategori saja**, dan penyebutnya ikut dikembalikan
 * bersama jumlah yang belum berkategori. Membagi dengan seluruh nasabah akan mengecilkan setiap
 * persentase sebanding banyaknya nasabah yang belum ditanyai — angka yang tampak wajar padahal
 * salah, dan tidak ada satu pun di layar yang menunjukkan sebabnya.
 */
export function foldCustomerComposition(
  rows: IraCustomerRow[],
  countryLevels: ReadonlyMap<string, IraRiskLevel> = new Map(),
): IraCustomerComposition {
  const berkategori = rows.filter((row) => row.occupationCategory !== null);
  const badanUsaha = rows.filter((row) => row.customerType === "BADAN_USAHA");
  const berbentuk = badanUsaha.filter((row) => row.entityLegalForm !== null);

  const berkewarganegaraan = rows.filter((row) => Boolean(row.nationality?.trim()));
  const occupationDenominator = new Decimal(berkategori.length);
  const legalFormDenominator = new Decimal(berbentuk.length);

  return {
    customersTotal: rows.length,
    customersWithoutCustomerType: rows.filter((row) => row.customerType === null).length,
    customersWithoutOccupationCategory: rows.filter((row) => row.customerType !== "BADAN_USAHA" && row.occupationCategory === null).length,
    customersWithoutLegalForm: badanUsaha.length - berbentuk.length,
    occupationDenominator: berkategori.length,
    legalFormDenominator: berbentuk.length,
    occupationCategories: IRA_OCCUPATION_CATEGORIES.map((code) => {
      const count = berkategori.filter((row) => row.occupationCategory === code).length;
      return { code, customerCount: count, sharePercent: share(new Decimal(count), occupationDenominator) };
    }),
    legalForms: IRA_LEGAL_FORMS.map((code) => {
      const count = berbentuk.filter((row) => row.entityLegalForm === code).length;
      return { code, customerCount: count, sharePercent: share(new Decimal(count), legalFormDenominator) };
    }),
    pepCustomerCount: rows.filter((row) => row.pepStatus !== "NONE").length,
    customersWithoutNationality: rows.filter((row) => !row.nationality?.trim()).length,
    nationalityDenominator: berkewarganegaraan.length,
    highRiskCountryCustomers: iraRiskTypes.map((riskType) => {
      // Nasabah yang belum berkategori ikut dihitung sebagai bukan badan usaha, sama seperti
      // `customersWithoutOccupationCategory`: nasabah lama yang belum ditanyai jenisnya hampir
      // selalu perorangan, dan mengeluarkannya justru menyembunyikan risiko yang ditanyakan.
      const matching = berkewarganegaraan.filter(
        (row) =>
          row.customerType !== "BADAN_USAHA" &&
          countryLevels.get(classificationKey("COUNTRY", row.nationality!.trim().toUpperCase(), riskType)) === "TINGGI",
      );
      return {
        riskType,
        customerCount: matching.length,
        sharePercent: share(new Decimal(matching.length), new Decimal(berkewarganegaraan.length)),
      };
    }),
  };
}

export type IraDataForm = IraTransactionComposition & IraCustomerComposition & {
  periodStart: Date;
  periodEnd: Date;
};

/**
 * Agregat Form C1 untuk satu periode penilaian.
 *
 * Batasnya berupa instan absolut dan itu benar: `transactionAt` adalah kolom `datetime` yang
 * menyimpan jam UTC, berbeda dari kolom `date`. Pemanggilnya membentuk batas periode dengan
 * `startOfOperationalMonth` / `startOfNextOperationalMonth`; tidak ada helper jendela keempat
 * yang ditulis di sini.
 *
 * Nasabah dihitung atas seluruh profil hidup, bukan hanya yang bertransaksi periode ini: Form C1
 * menanyakan komposisi nasabah lembaganya, bukan komposisi nasabah yang kebetulan aktif.
 */
export async function readIraDataForm(periodStart: Date, periodEnd: Date): Promise<IraDataForm> {
  const db = await databaseOrThrow();

  const bonFilter = and(
    gte(exchangeTransactions.transactionAt, periodStart),
    lt(exchangeTransactions.transactionAt, periodEnd),
    inArray(exchangeTransactions.status, [...ACCUMULATED_TRANSACTION_STATUSES]),
    eq(exchangeTransactions.isDemo, false),
    eq(exchangeTransactions.isHistorical, false),
    eq(customers.isDemo, false),
    eq(customers.isHistorical, false),
  );

  const legacyRows = db
    .select({
      transactionId: exchangeTransactions.id,
      bonRupiahAmount: exchangeTransactions.rupiahAmount,
      currencyCode: currencies.code,
      distributionChannel: exchangeTransactions.distributionChannel,
      nationality: customers.nationality,
    })
    .from(exchangeTransactions)
    .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
    .leftJoin(currencies, eq(exchangeTransactions.currencyId, currencies.id))
    .where(bonFilter);

  const lineRows = db
    .select({
      transactionId: exchangeTransactions.id,
      bonRupiahAmount: exchangeTransactions.rupiahAmount,
      lineRupiahAmount: exchangeTransactionLines.rupiahAmount,
      currencyCode: currencies.code,
      distributionChannel: exchangeTransactions.distributionChannel,
      nationality: customers.nationality,
    })
    .from(exchangeTransactions)
    .innerJoin(customers, eq(exchangeTransactions.customerId, customers.id))
    .innerJoin(exchangeTransactionLines, eq(exchangeTransactionLines.transactionId, exchangeTransactions.id))
    .innerJoin(currencies, eq(exchangeTransactionLines.currencyId, currencies.id))
    .where(bonFilter);

  const customerRows = db
    .select({
      id: customers.id,
      customerType: customers.customerType,
      entityLegalForm: customers.entityLegalForm,
      occupationCategory: customers.occupationCategory,
      pepStatus: customers.pepStatus,
      nationality: customers.nationality,
    })
    .from(customers)
    .where(and(eq(customers.isDemo, false), eq(customers.isHistorical, false)));

  const [legacy, lines, people, countryLevels] = await Promise.all([
    legacyRows,
    lineRows,
    customerRows,
    readCountryLevels(),
  ]);

  const rows: IraTransactionRow[] = [
    ...(legacy as Omit<IraTransactionRow, "source" | "lineRupiahAmount">[]).map((row) => ({ ...row, source: "LEGACY" as const, lineRupiahAmount: null })),
    ...(lines as Omit<IraTransactionRow, "source">[]).map((row) => ({ ...row, source: "LINE" as const })),
  ];

  return {
    periodStart,
    periodEnd,
    ...foldTransactionComposition(rows, countryLevels),
    ...foldCustomerComposition(people as IraCustomerRow[], countryLevels),
  };
}

/** Klasifikasi dimensi negara saja; peta penuhnya tidak dibutuhkan pembaca ini. */
async function readCountryLevels(): Promise<Map<string, IraRiskLevel>> {
  const { readClassifications } = await import("./iraRiskClassification");
  return readClassifications();
}
