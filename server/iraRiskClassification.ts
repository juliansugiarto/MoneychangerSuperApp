import { and, asc, eq } from "drizzle-orm";
import {
  iraParameterThresholds,
  iraRiskClassifications,
  type IraRiskDimension,
  type IraRiskLevel,
  type IraRiskType,
} from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import { IRA_BAND_INDEXES, IRA_DEFAULT_BAND_UPPER_BOUNDS, IRA_PARAMETERS, IRA_PARAMETER_CODES } from "../shared/iraParameters";
import { databaseOrThrow, writeAudit } from "./operations";

/**
 * Klasifikasi risiko inheren yang dipelihara manusia — mata uang, profesi, bentuk badan hukum,
 * negara, dan provinsi.
 *
 * Satu baris per `(dimension, code, riskType)`. Penilaian tidak pernah menyimpulkan sendiri bahwa
 * sebuah mata uang berisiko tinggi: yang menentukan adalah SRA beserta rujukannya, dan yang dicatat
 * di sini adalah keputusan manusia yang dapat ditelusuri sampai ke sumbernya.
 */

export type ClassificationActor = { id: number };

export type ClassifyRiskInput = {
  dimension: IraRiskDimension;
  code: string;
  riskType: IraRiskType;
  level: IraRiskLevel;
  sourceNote: string;
};

/**
 * Gerbang peran sebagai fungsi tersendiri, meniru `financialFormExportDenial`.
 *
 * Berada di luar handler dengan sengaja: otorisasi yang hanya hidup di dalam handler tidak pernah
 * dibuktikan uji mana pun, dan gerbang yang tidak diuji adalah gerbang yang diam-diam hilang pada
 * penyuntingan berikutnya.
 */
export function iraClassificationDenial(
  user: { role: string; mustChangePassword: boolean },
): { status: 403; message: string } | null {
  if (user.mustChangePassword) {
    return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum mengubah klasifikasi risiko." };
  }
  if (!isRoleAllowed(user.role as BackOfficeRole, "CONTROLLER")) {
    return { status: 403, message: "Hanya Controller ke atas yang dapat mengubah klasifikasi risiko." };
  }
  return null;
}

/** Kunci peta klasifikasi. Ditulis satu kali di sini agar penulis dan pembacanya tidak berbeda. */
export function classificationKey(dimension: IraRiskDimension, code: string, riskType: IraRiskType) {
  return `${dimension}|${code}|${riskType}`;
}

/**
 * Menyimpan satu klasifikasi, menimpa yang berkunci sama.
 *
 * `ON DUPLICATE KEY UPDATE` dan bukan hapus-lalu-tulis: kunci uniknya menjaga agar satu kode tidak
 * pernah punya dua tingkat yang bertentangan untuk jenis risiko yang sama, dan menghapus lebih dulu
 * membuka jendela ketika kodenya terbaca RENDAH padahal sesungguhnya TINGGI.
 */
export async function classifyRisk(input: ClassifyRiskInput, actor: ClassificationActor) {
  const sourceNote = input.sourceNote.trim();
  // Klasifikasi tanpa rujukan adalah angka tanpa asal; pemeriksa menanyakan dasarnya, bukan
  // nilainya saja. Ditegakkan di sini dan bukan hanya di Zod agar pemanggil mana pun terkena.
  if (!sourceNote) throw new Error("Alasan atau rujukan SRA wajib diisi untuk setiap klasifikasi risiko.");
  const code = input.code.trim();
  if (!code) throw new Error("Kode yang diklasifikasikan wajib diisi.");

  const db = await databaseOrThrow();
  const [existing] = await db
    .select({ level: iraRiskClassifications.level, sourceNote: iraRiskClassifications.sourceNote })
    .from(iraRiskClassifications)
    .where(and(
      eq(iraRiskClassifications.dimension, input.dimension),
      eq(iraRiskClassifications.code, code),
      eq(iraRiskClassifications.riskType, input.riskType),
    ))
    .limit(1);

  await db
    .insert(iraRiskClassifications)
    .values({
      dimension: input.dimension,
      code,
      riskType: input.riskType,
      level: input.level,
      sourceNote,
      updatedByUserId: actor.id,
    })
    .onDuplicateKeyUpdate({ set: { level: input.level, sourceNote, updatedByUserId: actor.id } });

  await writeAudit({
    actorUserId: actor.id,
    action: existing ? "IRA_CLASSIFICATION_UPDATED" : "IRA_CLASSIFICATION_CREATED",
    entityType: "ira_risk_classification",
    entityId: classificationKey(input.dimension, code, input.riskType),
    beforeState: existing ? { level: existing.level, sourceNote: existing.sourceNote } : null,
    afterState: { level: input.level, sourceNote },
  });
}

export type ClassificationRow = {
  dimension: IraRiskDimension;
  code: string;
  riskType: IraRiskType;
  level: IraRiskLevel;
  sourceNote: string;
  updatedByUserId: number;
  updatedAt: Date;
};

/** Seluruh baris klasifikasi apa adanya — untuk halaman pemeliharaannya. */
export async function listClassifications(): Promise<ClassificationRow[]> {
  const db = await databaseOrThrow();
  return (await db
    .select({
      dimension: iraRiskClassifications.dimension,
      code: iraRiskClassifications.code,
      riskType: iraRiskClassifications.riskType,
      level: iraRiskClassifications.level,
      sourceNote: iraRiskClassifications.sourceNote,
      updatedByUserId: iraRiskClassifications.updatedByUserId,
      updatedAt: iraRiskClassifications.updatedAt,
    })
    .from(iraRiskClassifications)
    .orderBy(asc(iraRiskClassifications.dimension), asc(iraRiskClassifications.code))) as ClassificationRow[];
}

/** Peta tingkat risiko berkunci `dimension|code|riskType`, untuk penilaian yang membaca banyak kode. */
export async function readClassifications(): Promise<Map<string, IraRiskLevel>> {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      dimension: iraRiskClassifications.dimension,
      code: iraRiskClassifications.code,
      riskType: iraRiskClassifications.riskType,
      level: iraRiskClassifications.level,
    })
    .from(iraRiskClassifications);
  return new Map(rows.map((row) => [classificationKey(row.dimension, row.code, row.riskType), row.level]));
}

/**
 * Tingkat risiko sebuah kode; **RENDAH bila belum pernah diklasifikasikan**.
 *
 * Ketiadaan yang berperilaku seperti RENDAH ditulis satu kali di sini, bukan diulang setiap
 * pemanggil: pemanggil yang lupa akan mendapat `undefined` dan mendiamkan kodenya keluar dari
 * hitungan, sehingga penyebutnya mengecil tanpa ada yang menyadarinya. Yang belum diklasifikasikan
 * tetap terlihat — halaman pemeliharaannya menampilkan hitungannya di urutan pertama.
 */
export function classificationLevel(
  levels: ReadonlyMap<string, IraRiskLevel>,
  dimension: IraRiskDimension,
  code: string,
  riskType: IraRiskType,
): IraRiskLevel {
  return levels.get(classificationKey(dimension, code, riskType)) ?? "RENDAH";
}

export type ParameterBands = {
  parameterCode: string;
  /** Lima batas atas dalam persen, urut pita 1..5; yang terakhir `null` (tak berbatas atas). */
  upperBoundPercent: (string | null)[];
  updatedByUserId: number | null;
  updatedAt: Date | null;
  /** Belum pernah disunting — nilainya masih bawaan template, bukan tersimpan di basis data. */
  isTemplateDefault: boolean;
};

/**
 * Memeriksa satu susunan pita. Murni, sehingga aturannya punya uji tanpa basis data.
 *
 * Pita yang tidak menaik atau berbatas atas pada pita teratas akan membuat sebuah persentase jatuh
 * ke dua pita sekaligus, atau ke tak satu pun — dan penilaian yang tidak menemukan pitanya akan
 * diam-diam menghasilkan nilai kosong, bukan galat.
 */
export function bandValidationError(bounds: (string | null)[]): string | null {
  if (bounds.length !== IRA_BAND_INDEXES.length) return `Wajib tepat ${IRA_BAND_INDEXES.length} pita.`;
  if (bounds.at(-1) !== null) return "Pita teratas wajib tanpa batas atas (kosong).";
  let previous = 0;
  for (const bound of bounds.slice(0, -1)) {
    if (bound === null) return "Hanya pita teratas yang boleh tanpa batas atas.";
    const value = Number(bound);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return "Batas atas pita harus antara 0 dan 100 persen.";
    if (value <= previous) return "Batas atas tiap pita harus lebih besar daripada pita sebelumnya.";
    previous = value;
  }
  return null;
}

/** Ambang seluruh 33 parameter; yang belum pernah disunting dikembalikan dengan nilai template. */
export async function listParameterThresholds(): Promise<ParameterBands[]> {
  const db = await databaseOrThrow();
  const rows = await db
    .select({
      parameterCode: iraParameterThresholds.parameterCode,
      bandIndex: iraParameterThresholds.bandIndex,
      upperBoundPercent: iraParameterThresholds.upperBoundPercent,
      updatedByUserId: iraParameterThresholds.updatedByUserId,
      updatedAt: iraParameterThresholds.updatedAt,
    })
    .from(iraParameterThresholds);

  const stored = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = stored.get(row.parameterCode) ?? [];
    bucket.push(row);
    stored.set(row.parameterCode, bucket as typeof rows);
  }

  return IRA_PARAMETERS.map((parameter) => {
    const bucket = stored.get(parameter.code);
    if (!bucket || bucket.length !== IRA_BAND_INDEXES.length) {
      // Belum disunting: bawaan template, dan itu dinyatakan lewat `isTemplateDefault` alih-alih
      // dikirim sebagai baris kosong yang di layar tampak seperti ambang yang hilang.
      return { parameterCode: parameter.code, upperBoundPercent: [...IRA_DEFAULT_BAND_UPPER_BOUNDS], updatedByUserId: null, updatedAt: null, isTemplateDefault: true };
    }
    const sorted = [...bucket].sort((left, right) => left.bandIndex - right.bandIndex);
    const latest = sorted.reduce((newest, row) => (row.updatedAt > newest.updatedAt ? row : newest), sorted[0]);
    return {
      parameterCode: parameter.code,
      upperBoundPercent: sorted.map((row) => row.upperBoundPercent),
      updatedByUserId: latest.updatedByUserId,
      updatedAt: latest.updatedAt,
      isTemplateDefault: false,
    };
  });
}

/**
 * Menyimpan lima pita satu parameter, menimpa yang sudah ada.
 *
 * Nilai sebelumnya dicatat ke `audit_logs`: ambang yang bergeser mengubah setiap nilai parameter
 * sesudahnya, dan pemeriksa yang membandingkan dua penilaian harus dapat melihat bahwa yang berubah
 * adalah pitanya, bukan keadaan usahanya.
 */
export async function setParameterThresholds(
  input: { parameterCode: string; upperBoundPercent: (string | null)[] },
  actor: ClassificationActor,
) {
  if (!IRA_PARAMETER_CODES.includes(input.parameterCode)) throw new Error(`Parameter tidak dikenal: ${input.parameterCode}`);
  const invalid = bandValidationError(input.upperBoundPercent);
  if (invalid) throw new Error(invalid);

  const before = (await listParameterThresholds()).find((row) => row.parameterCode === input.parameterCode);
  const db = await databaseOrThrow();
  for (const bandIndex of IRA_BAND_INDEXES) {
    const upperBoundPercent = input.upperBoundPercent[bandIndex - 1];
    await db
      .insert(iraParameterThresholds)
      .values({ parameterCode: input.parameterCode, bandIndex, upperBoundPercent, updatedByUserId: actor.id })
      .onDuplicateKeyUpdate({ set: { upperBoundPercent, updatedByUserId: actor.id } });
  }

  await writeAudit({
    actorUserId: actor.id,
    action: "IRA_THRESHOLD_UPDATED",
    entityType: "ira_parameter_threshold",
    entityId: input.parameterCode,
    beforeState: before ? { upperBoundPercent: before.upperBoundPercent, isTemplateDefault: before.isTemplateDefault } : null,
    afterState: { upperBoundPercent: input.upperBoundPercent },
  });
}

/** Mengembalikan satu parameter ke pita template, tercatat seperti penyuntingan biasa. */
export async function resetParameterThresholds(parameterCode: string, actor: ClassificationActor) {
  await setParameterThresholds({ parameterCode, upperBoundPercent: [...IRA_DEFAULT_BAND_UPPER_BOUNDS] }, actor);
}
