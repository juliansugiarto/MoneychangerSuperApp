/**
 * Penghitung sisi risiko inheren: agregat Form C1 × klasifikasi SRA × katalog parameter → nilai
 * tiap parameter A1.
 *
 * **Murni.** Masuk agregat, klasifikasi, provinsi gerai, dan ambang; keluar 33 nilai beserta angka
 * mentahnya. Tidak ada `getDb`, tidak ada `new Date()`. Yang menyentuh basis data adalah
 * pemanggilnya (Tugas 6), sehingga seluruh perhitungan kepatuhan dapat diuji tanpa MySQL — dan
 * perhitungan kepatuhan yang hanya dapat diuji dengan basis data hidup adalah perhitungan yang pada
 * praktiknya tidak pernah diuji.
 *
 * **Kesembilan parameter `NYATAKAN` sengaja tidak dihitung di sini.** Nilainya kosong, bukan nol:
 * nol pada skala terbalik berarti lebih buruk daripada risiko tertinggi, dan penilaian yang
 * kehilangan pernyataan penilainya harus terlihat kosong, bukan tampak sudah dinilai. Penulisnya
 * adalah borang penilaian itu sendiri (`ira_structural_declarations`).
 *
 * Setiap nilai membawa `basis` — pembilang, penyebut, persentase, dan pita yang terpilih. Pemeriksa
 * yang bertanya "dari mana angka ini?" dijawab layar, bukan dijawab dengan membuka kode.
 */

import Decimal from "decimal.js";
import type { IraRiskLevel, IraRiskType } from "../drizzle/schema";
import {
  scoreFromPercentageBand,
  scoreFromPresence,
} from "../shared/individualRiskAssessment";
import { bandDefinition, catalogueEntry, IRA_PARAMETER_CATALOGUE } from "../shared/iraParameterCatalogue";
import { scoreFromBand } from "../shared/iraParameters";
import type { IraParameterRiskType, IraParameterSource } from "../shared/iraParameters";
import type { IraProvince } from "../shared/iraVocabulary";
import type { IraDataForm } from "./iraDataForm";
import { classificationKey } from "./iraRiskClassification";

export type InherentScoringInput = {
  /** Agregat Form C1 satu periode. */
  form: IraDataForm;
  /** Peta klasifikasi berkunci `dimension|code|riskType`; yang tidak ada dibaca RENDAH. */
  levels: ReadonlyMap<string, IraRiskLevel>;
  /** Provinsi gerai dari `company_profile`. `null` berarti belum diisi — bukan berarti rendah. */
  province: IraProvince | null;
  /** Ambang tersimpan per parameter; yang tidak ada memakai bawaan jenis pitanya. */
  thresholds: ReadonlyMap<string, (string | null)[]>;
};

/** Angka mentah pembentuk sebuah nilai, apa adanya, untuk ditampilkan di layar penelusuran. */
export type InherentBasis = Record<string, string | number | boolean | null>;

export type InherentParameterValue = {
  code: string;
  riskType: IraParameterRiskType;
  group: string;
  source: IraParameterSource;
  /** Nilai 1-5; `null` bila dinyatakan penilai atau bila sumbernya belum ada. */
  machineScore: number | null;
  /** Pita 1-5 yang terpilih; `null` pada parameter berpilihan dan yang tidak terhitung. */
  bandIndex: number | null;
  basis: InherentBasis | null;
  /** Alasan nilainya kosong padahal parameternya terhitung — mis. provinsi gerai belum diisi. */
  missingReason: string | null;
};

const NOL = "0.00";

/** Persentase dua desimal; penyebut nol menghasilkan "0.00", bukan NaN maupun galat pembagian. */
const percentOf = (part: Decimal, whole: Decimal): string => (whole.isZero() ? NOL : part.dividedBy(whole).times(100).toFixed(2));

const levelOf = (
  levels: ReadonlyMap<string, IraRiskLevel>,
  dimension: Parameters<typeof classificationKey>[0],
  code: string,
  riskType: IraRiskType,
): IraRiskLevel => levels.get(classificationKey(dimension, code, riskType)) ?? "RENDAH";

/** Ambang yang berlaku bagi sebuah parameter: yang tersimpan bila ada, selebihnya bawaan jenis pitanya. */
function boundsFor(input: InherentScoringInput, code: string): { bounds: (string | null)[]; fromDatabase: boolean } {
  const stored = input.thresholds.get(code);
  if (stored) return { bounds: [...stored], fromDatabase: true };
  const fallback = bandDefinition(catalogueEntry(code).bandType).defaultUpperBounds;
  if (!fallback) throw new Error(`Parameter ${code} tidak berpita persentase; tidak dapat dinilai lewat ambang.`);
  return { bounds: [...fallback], fromDatabase: false };
}

/** Nilai sebuah parameter persentase beserta angka mentahnya. */
function fromPercentage(
  input: InherentScoringInput,
  code: string,
  numerator: string,
  denominator: string,
  extra: InherentBasis = {},
): { machineScore: number; bandIndex: number; basis: InherentBasis } {
  const percent = percentOf(new Decimal(numerator), new Decimal(denominator));
  const { bounds, fromDatabase } = boundsFor(input, code);
  const machineScore = scoreFromPercentageBand(percent, bounds);
  return {
    machineScore,
    // Pita adalah kebalikan nilainya; ditulis lewat rumus yang sama agar keduanya tidak dapat berselisih.
    bandIndex: 6 - machineScore,
    basis: { numerator, denominator, percent, bandsFromDatabase: fromDatabase, ...extra },
  };
}

/** Omzet mata uang pada tingkat risiko tertentu, dibagi seluruh omzet periode itu. */
function currencyShare(input: InherentScoringInput, code: string, riskType: IraRiskType, level: IraRiskLevel) {
  const matching = input.form.currencyTurnover.filter((row) => levelOf(input.levels, "CURRENCY", row.code, riskType) === level);
  const numerator = matching.reduce((sum, row) => sum.plus(row.rupiah), new Decimal(0)).toFixed(2);
  return fromPercentage(input, code, numerator, input.form.totalRupiah, {
    currencies: matching.map((row) => row.code).join(", ") || null,
    level,
  });
}

/** Banyaknya bon lewat jalur pada tingkat risiko tertentu, dibagi seluruh bon periode itu. */
function channelShare(input: InherentScoringInput, code: string, riskType: IraRiskType, level: IraRiskLevel) {
  const matching = input.form.distributionChannels.filter(
    (row) => levelOf(input.levels, "DISTRIBUTION_CHANNEL", row.channel, riskType) === level,
  );
  const numerator = matching.reduce((sum, row) => sum + row.transactionCount, 0);
  return fromPercentage(input, code, String(numerator), String(input.form.transactionCount), {
    channels: matching.map((row) => row.channel).join(", ") || null,
    level,
  });
}

/** Nasabah berprofesi pada tingkat risiko tertentu, dibagi nasabah **berkategori**. */
function occupationShare(input: InherentScoringInput, code: string, riskType: IraRiskType, level: IraRiskLevel) {
  const matching = input.form.occupationCategories.filter((row) => levelOf(input.levels, "OCCUPATION", row.code, riskType) === level);
  const numerator = matching.reduce((sum, row) => sum + row.customerCount, 0);
  return fromPercentage(input, code, String(numerator), String(input.form.occupationDenominator), {
    level,
    // Penyebutnya nasabah berkategori saja; yang belum ditanyai ikut dilaporkan agar persentase
    // yang tampak kecil tidak terbaca sebagai keadaan yang aman.
    customersWithoutCategory: input.form.customersWithoutOccupationCategory,
  });
}

/** Badan usaha berbentuk hukum pada tingkat risiko tertentu, dibagi badan usaha **berbentuk**. */
function legalFormShare(input: InherentScoringInput, code: string, riskType: IraRiskType, level: IraRiskLevel) {
  const matching = input.form.legalForms.filter((row) => levelOf(input.levels, "LEGAL_FORM", row.code, riskType) === level);
  const numerator = matching.reduce((sum, row) => sum + row.customerCount, 0);
  return fromPercentage(input, code, String(numerator), String(input.form.legalFormDenominator), {
    level,
    customersWithoutLegalForm: input.form.customersWithoutLegalForm,
  });
}

/** Nilai berdasarkan peringkat SRA sebuah provinsi — bukan persentase, melainkan tingkat. */
function provinceLevel(input: InherentScoringInput, riskType: IraRiskType) {
  if (!input.province) {
    return {
      machineScore: null,
      bandIndex: null,
      basis: null,
      missingReason: "Provinsi gerai belum diisi pada Profil Perusahaan, sehingga peringkat wilayahnya tidak dapat dibaca.",
    };
  }
  const level = levelOf(input.levels, "PROVINCE", input.province, riskType);
  const choice = bandDefinition("TINGKAT_RISIKO").choices!.find((entry) => entry.code === level)!;
  return {
    machineScore: scoreFromBand(choice.bandIndex),
    bandIndex: choice.bandIndex,
    basis: { province: input.province, level, riskType },
    missingReason: null,
  };
}

/** Nilai kehadiran: ada berarti risiko tertinggi. */
function presence(present: boolean, basis: InherentBasis) {
  return { machineScore: scoreFromPresence(present), bandIndex: present ? 5 : 1, basis };
}

const countryRow = (form: IraDataForm, riskType: IraRiskType) => form.highRiskCountry.find((row) => row.riskType === riskType)!;
const countryCustomerRow = (form: IraDataForm, riskType: IraRiskType) =>
  form.highRiskCountryCustomers.find((row) => row.riskType === riskType)!;

/**
 * Nilai kedua puluh empat parameter terhitung, berkunci kodenya.
 *
 * Ditulis sebagai peta dan bukan rantai `if`: parameter yang kelupaan akan hilang dari peta dan
 * langsung tertangkap uji "seluruh parameter HITUNG punya nilai", bukan diam-diam bernilai kosong.
 */
function computedValues(input: InherentScoringInput) {
  const { form } = input;
  const computed: Record<string, ReturnType<typeof fromPercentage> | ReturnType<typeof provinceLevel>> = {
    // Produk/Jasa — komposisi omzet per mata uang menurut klasifikasi SRA.
    TPPU_1A: currencyShare(input, "TPPU_1A", "TPPU", "TINGGI"),
    TPPU_1B: currencyShare(input, "TPPU_1B", "TPPU", "MENENGAH"),
    TPPT_1A: currencyShare(input, "TPPT_1A", "TPPT", "TINGGI"),
    TPPT_1B: currencyShare(input, "TPPT_1B", "TPPT", "MENENGAH"),
    PPSPM_1A: currencyShare(input, "PPSPM_1A", "PPSPM", "TINGGI"),

    // Jalur Distribusi — tingkat risikonya dinyatakan Controller, bukan disimpulkan aplikasi.
    TPPU_2A: channelShare(input, "TPPU_2A", "TPPU", "TINGGI"),
    TPPU_2B: channelShare(input, "TPPU_2B", "TPPU", "MENENGAH"),
    TPPT_2A: channelShare(input, "TPPT_2A", "TPPT", "TINGGI"),
    TPPT_2B: channelShare(input, "TPPT_2B", "TPPT", "MENENGAH"),

    // Pengguna Jasa — profesi, bentuk badan hukum, dan kewarganegaraan.
    TPPU_3A: occupationShare(input, "TPPU_3A", "TPPU", "TINGGI"),
    TPPU_3B: occupationShare(input, "TPPU_3B", "TPPU", "MENENGAH"),
    TPPU_3C: legalFormShare(input, "TPPU_3C", "TPPU", "TINGGI"),
    TPPU_3D: legalFormShare(input, "TPPU_3D", "TPPU", "MENENGAH"),
    TPPT_3A: occupationShare(input, "TPPT_3A", "TPPT", "TINGGI"),
    TPPT_3B: occupationShare(input, "TPPT_3B", "TPPT", "MENENGAH"),
    PPSPM_3B: occupationShare(input, "PPSPM_3B", "PPSPM", "TINGGI"),
    /**
     * Badan usaha PT non-UMKM. Skala usaha **tidak tersimpan di mana pun**, sehingga yang terhitung
     * adalah seluruh nasabah berbentuk PT. Perbedaannya ditulis pada `basis` agar pemeriksa membaca
     * batasnya di layar, bukan menyangkanya angka yang persis.
     */
    PPSPM_3C: (() => {
      const value = legalFormShare(input, "PPSPM_3C", "PPSPM", "TINGGI");
      return {
        ...value,
        basis: {
          ...value.basis,
          note: "Skala usaha tidak tersimpan; seluruh nasabah berbentuk PT ikut terhitung, termasuk yang UMKM.",
        },
      };
    })(),
    /** Komposisi **nasabah** dari negara sanksi PBB — bukan komposisi transaksinya. */
    PPSPM_3A: fromPercentage(
      input,
      "PPSPM_3A",
      String(countryCustomerRow(form, "PPSPM").customerCount),
      String(form.nationalityDenominator),
      { customersWithoutNationality: form.customersWithoutNationality },
    ),

    // Wilayah Geografis — peringkat SRA provinsi gerai, satu-satunya lokasi yang tersimpan.
    TPPU_4A: provinceLevel(input, "TPPU"),
    TPPU_4B: provinceLevel(input, "TPPU"),
    TPPT_4A: provinceLevel(input, "TPPT"),
    TPPT_4B: provinceLevel(input, "TPPT"),

    /** Persentase transaksi yang melibatkan nasabah dari negara sanksi PBB. */
    PPSPM_4A: fromPercentage(
      input,
      "PPSPM_4A",
      String(countryRow(form, "PPSPM").transactionCount),
      String(form.transactionCount),
      { rupiah: countryRow(form, "PPSPM").rupiah },
    ),
  };

  // Kehadiran WN/BH negara "black"/"grey" FATF: pertanyaannya ada atau tidak ada, bukan seberapa banyak.
  const fatf = countryRow(form, "TPPU");
  return {
    ...computed,
    TPPU_3E: {
      ...presence(fatf.transactionCount > 0, { transactionCount: fatf.transactionCount, rupiah: fatf.rupiah }),
      missingReason: null,
    },
  } as Record<string, { machineScore: number | null; bandIndex: number | null; basis: InherentBasis | null; missingReason?: string | null }>;
}

/**
 * Nilai ke-33 parameter untuk satu periode.
 *
 * Urutannya mengikuti katalog, sehingga baris di layar sama urutannya dengan lembar `A1`.
 */
export function scoreInherentParameters(input: InherentScoringInput): InherentParameterValue[] {
  const computed = computedValues(input);

  return IRA_PARAMETER_CATALOGUE.map((entry) => {
    if (entry.source === "NYATAKAN") {
      return { code: entry.code, riskType: entry.riskType, group: entry.group, source: entry.source, machineScore: null, bandIndex: null, basis: null, missingReason: null };
    }
    const value = computed[entry.code];
    if (!value) throw new Error(`Parameter terhitung ${entry.code} tidak punya penghitung.`);
    return {
      code: entry.code,
      riskType: entry.riskType,
      group: entry.group,
      source: entry.source,
      machineScore: value.machineScore,
      bandIndex: value.bandIndex,
      basis: value.basis,
      missingReason: value.missingReason ?? null,
    };
  });
}
