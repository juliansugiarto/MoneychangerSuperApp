import { and, eq } from "drizzle-orm";
import { auditLogs, customers } from "../drizzle/schema";
import { isRoleAllowed, type BackOfficeRole } from "../shared/backOfficeNavigation";
import { getDb } from "./db";

/**
 * Persetujuan Manajemen Senior atas nasabah berisiko tinggi — Pasal 32 ayat (5) dan (6) PBI
 * 10/2024.
 *
 * Ini **pemblokiran operasional pertama** di aplikasi ini dan disengaja: nasabah `HIGH` yang belum
 * diputuskan tidak dapat dipakai pada bon baru. Karena itu dua hal dipisahkan dengan tegas di sini.
 *
 * 1. **Penolakannya fungsi murni.** Ia tidak membaca basis data dan tidak menulis apa pun, sehingga
 *    layar, penulis transaksi, dan uji memakai aturan yang sama persis. Aturan pemblokiran yang
 *    hidup di dalam handler adalah aturan yang cepat atau lambat berbeda antara satu jalur dan
 *    jalur lain.
 * 2. **Penegakannya di penulis, bukan hanya di router** — preseden `iraEditDenial`/
 *    `iraApprovalDenial`. Gerbang peran di router menjaga layar; penulisnya yang menjaga data.
 */

export type HighRiskDecision = "BELUM" | "DISETUJUI" | "DITOLAK";
export type CustomerRiskLevel = "LOW" | "MEDIUM" | "HIGH";

type GateUser = { role: string; mustChangePassword: boolean };
type Denial = { status: 403; message: string } | null;

/** Bentuk minimal yang dibutuhkan gerbang: tingkat risiko dan keputusannya, bukan seluruh nasabah. */
export type HighRiskGateCustomer = { riskLevel: CustomerRiskLevel; highRiskDecision: HighRiskDecision };

/**
 * Alasan penolakan bon bagi satu nasabah, atau `null` bila ia boleh dipakai.
 *
 * `label` menyebut pihak mana yang tertahan — nasabah transaksi atau pihak kuasa/wakilnya —
 * supaya petugas tidak perlu menebak profil mana yang harus diurus.
 *
 * `DITOLAK` dan `BELUM` sengaja berbunyi berbeda: menyuruh menunggu keputusan yang justru sudah
 * dijatuhkan akan membuat petugas menunggu sesuatu yang tidak akan datang.
 */
export function customerHighRiskDenial(customer: HighRiskGateCustomer, label = "Nasabah"): string | null {
  if (customer.riskLevel !== "HIGH") return null;
  if (customer.highRiskDecision === "DISETUJUI") return null;
  if (customer.highRiskDecision === "DITOLAK") {
    return `${label} berisiko tinggi ini ditolak Pemegang Saham (SHAREHOLDER); hubungan usahanya dihentikan dan bon baru tidak dapat dibuat atas namanya.`;
  }
  return `${label} berisiko tinggi ini belum diputuskan Pemegang Saham (SHAREHOLDER). Mintakan keputusan persetujuan pada profil nasabahnya sebelum membuat bon.`;
}

/** Gerbang keputusan. **Hanya SHAREHOLDER** — Controller sekalipun tidak. */
export function highRiskDecisionDenial(user: GateUser): Denial {
  if (user.mustChangePassword) {
    return { status: 403, message: "Ganti kata sandi terlebih dahulu sebelum memutuskan nasabah berisiko tinggi." };
  }
  if (!isRoleAllowed(user.role as BackOfficeRole, "SHAREHOLDER")) {
    return { status: 403, message: "Hanya Pemegang Saham yang dapat memutuskan nasabah berisiko tinggi." };
  }
  return null;
}

/**
 * Nilai setel ulang bila `riskLevel` **berpindah menjadi** `HIGH`, atau `null` bila tidak.
 *
 * `HIGH → HIGH` tidak menyetel ulang: bila ia menyetel ulang, setiap penyuntingan nasabah berisiko
 * tinggi akan mencabut persetujuan yang sah dan menghentikan operasionalnya tanpa alasan. Yang
 * dijaga aturan ini adalah keadaan sebaliknya — persetujuan lama tidak boleh diam-diam menaungi
 * risiko tinggi yang timbul karena alasan baru.
 */
export function highRiskResetValues(previousRiskLevel: CustomerRiskLevel, nextRiskLevel: CustomerRiskLevel) {
  if (nextRiskLevel !== "HIGH" || previousRiskLevel === "HIGH") return null;
  return {
    highRiskDecision: "BELUM" as const,
    highRiskDecidedByUserId: null,
    highRiskDecidedAt: null,
    highRiskDecisionNotes: null,
  };
}

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Basis data tidak tersedia.");
  return db;
}

/**
 * Mencatat keputusan Pemegang Saham atas satu nasabah berisiko tinggi.
 *
 * Perannya diperiksa di sini juga, bukan hanya di router: gerbang peran yang hanya ada di router
 * runtuh begitu ada pemanggil kedua.
 */
export async function decideHighRisk(
  input: { customerId: number; decision: "DISETUJUI" | "DITOLAK"; notes: string },
  actor: { id: number; role: string },
) {
  if (!isRoleAllowed(actor.role as BackOfficeRole, "SHAREHOLDER")) {
    throw new Error("Hanya Pemegang Saham (SHAREHOLDER) yang dapat memutuskan nasabah berisiko tinggi.");
  }
  const notes = input.notes.trim();
  if (notes.length < 5) {
    throw new Error("Alasan keputusan wajib diisi (minimal 5 karakter) — keputusan berisiko tinggi tanpa alasan tertulis tidak dapat dijelaskan kepada pemeriksa.");
  }

  const db = await databaseOrThrow();
  const existing = (await db.select().from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.isDemo, false), eq(customers.isHistorical, false))).limit(1))[0];
  if (!existing) throw new Error("Nasabah tidak ditemukan.");
  if (existing.riskLevel !== "HIGH") {
    // Keputusan atas nasabah yang belum berisiko tinggi tidak menaungi apa pun: begitu tingkat
    // risikonya berpindah menjadi HIGH, aturan setel ulang mencabutnya lagi.
    throw new Error("Keputusan ini hanya berlaku bagi nasabah berisiko tinggi (HIGH).");
  }

  const nextValues = {
    highRiskDecision: input.decision,
    highRiskDecidedByUserId: actor.id,
    highRiskDecidedAt: new Date(),
    highRiskDecisionNotes: notes,
  };
  await db.update(customers).set(nextValues).where(eq(customers.id, input.customerId));
  await db.insert(auditLogs).values({
    actorUserId: actor.id,
    action: "CUSTOMER_HIGH_RISK_DECIDED",
    entityType: "customer",
    entityId: String(input.customerId),
    beforeState: {
      highRiskDecision: existing.highRiskDecision,
      highRiskDecidedByUserId: existing.highRiskDecidedByUserId,
      highRiskDecidedAt: existing.highRiskDecidedAt,
      highRiskDecisionNotes: existing.highRiskDecisionNotes,
      riskLevel: existing.riskLevel,
    },
    afterState: nextValues,
    reason: notes,
  });

  return { ...existing, ...nextValues };
}
