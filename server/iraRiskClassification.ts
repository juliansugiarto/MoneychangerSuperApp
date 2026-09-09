import { and, asc, eq } from "drizzle-orm";
import {
  iraRiskClassifications,
  type IraRiskDimension,
  type IraRiskLevel,
  type IraRiskType,
} from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
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
