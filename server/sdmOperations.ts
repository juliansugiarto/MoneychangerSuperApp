import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  employeeCertifications,
  employeePicAssignments,
  employees,
  sdmCompetencyPlans,
  type jobLevels,
  type picRoles,
  type competencyTracks,
  type employmentStatuses,
  type screeningResults,
} from "../drizzle/schema";
import {
  KUPVA_WORK_AREA,
  buildSdmTextFile,
  certificateNumberMismatch,
  competencyCodesForArea,
  deriveSdmCounts,
  formForPeriod,
  quarterEndDate,
  quarterStartDate,
  validateSdmReport,
  type CertificationForReport,
  type EmployeeForReport,
} from "../shared/sdmCompetency";
import { databaseOrThrow, retryTransientDatabaseRead, writeAudit } from "./operations";

type JobLevel = (typeof jobLevels)[number];
type PicRole = (typeof picRoles)[number];
type CompetencyTrack = (typeof competencyTracks)[number];
type EmploymentStatus = (typeof employmentStatuses)[number];
type ScreeningResult = (typeof screeningResults)[number];

const asIsoDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

export async function listEmployees() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(employees).orderBy(asc(employees.jobLevel), asc(employees.fullName));
  });
}

export async function listEmployeeCertifications(employeeId?: number) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const query = db.select().from(employeeCertifications);
    const rows = employeeId
      ? await query.where(eq(employeeCertifications.employeeId, employeeId))
      : await query;
    return rows.sort((a, b) => Number(new Date(b.issuedAt)) - Number(new Date(a.issuedAt)));
  });
}

export async function listPicAssignments() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(employeePicAssignments).orderBy(desc(employeePicAssignments.assignedAt));
  });
}

export async function createEmployee(
  input: {
    fullName: string; position: string; jobLevel: JobLevel; competencyTrack: CompetencyTrack;
    joinedAt: Date; identityNumber?: string; address?: string; education?: string; competencyLevel?: JobLevel;
    employmentAgreementNumber?: string; employmentAgreementAt?: Date;
    screeningResult?: ScreeningResult; screenedAt?: Date; screeningNotes?: string; notes?: string;
  },
  actor: { id: number },
) {
  const fullName = input.fullName.trim();
  const position = input.position.trim();
  if (!fullName || !position) throw new Error("Nama dan jabatan pegawai wajib diisi.");
  // Temuan pemeriksaan butir 12 meminta penyaringan calon pegawai terdokumentasi; hasil tanpa
  // catatan tidak membuktikan apa pun ketika diminta pemeriksa.
  if (input.screeningResult && input.screeningResult !== "DALAM_PROSES" && !input.screeningNotes?.trim()) {
    throw new Error("Hasil penyaringan calon pegawai wajib disertai catatan.");
  }
  if (input.employmentAgreementAt && !input.employmentAgreementNumber?.trim()) {
    throw new Error("Tanggal Perjanjian Kerja harus disertai nomornya.");
  }

  const db = await databaseOrThrow();
  const values = {
    fullName, position, jobLevel: input.jobLevel, competencyTrack: input.competencyTrack,
    competencyLevel: input.competencyLevel ?? null,
    joinedAt: input.joinedAt,
    identityNumber: input.identityNumber?.trim() || null,
    address: input.address?.trim() || null,
    education: input.education?.trim() || null,
    employmentAgreementNumber: input.employmentAgreementNumber?.trim() || null,
    employmentAgreementAt: input.employmentAgreementAt ?? null,
    screeningResult: input.screeningResult ?? null,
    screenedAt: input.screenedAt ?? null,
    screeningNotes: input.screeningNotes?.trim() || null,
    screenedByUserId: input.screeningResult ? actor.id : null,
    notes: input.notes?.trim() || null,
    createdByUserId: actor.id,
  };
  const [inserted] = await db.insert(employees).values(values).$returningId();
  await writeAudit({ actorUserId: actor.id, action: "EMPLOYEE_CREATED", entityType: "employees", entityId: String(inserted.id), afterState: { fullName, position, jobLevel: input.jobLevel } });
  return inserted;
}

export async function endEmployment(input: { employeeId: number; endedAt: Date; notes?: string }, actor: { id: number }) {
  const db = await databaseOrThrow();
  await db.update(employees)
    .set({ employmentStatus: "NONAKTIF", endedAt: input.endedAt, notes: input.notes?.trim() || null })
    .where(eq(employees.id, input.employeeId));
  await writeAudit({ actorUserId: actor.id, action: "EMPLOYEE_ENDED", entityType: "employees", entityId: String(input.employeeId), afterState: { endedAt: input.endedAt } });
}

export async function recordCertification(
  input: { employeeId: number; competencyCode: string; issuedAt: Date; certificateNumber?: string; expiresAt?: Date; documentId?: number; notes?: string },
  actor: { id: number },
) {
  const known = competencyCodesForArea(KUPVA_WORK_AREA).some((entry) => entry.code === input.competencyCode);
  // Sandi di luar daftar resmi tidak akan dikenali penerima laporan, jadi ditolak sejak awal.
  if (!known) throw new Error(`Sandi kompetensi ${input.competencyCode} tidak berlaku bagi KUPVA BB.`);
  if (input.expiresAt && input.expiresAt <= input.issuedAt) throw new Error("Masa berlaku sertifikat harus setelah tanggal terbit.");
  // Nomor sertifikat LPK memuat bidang dan jenjang KKNI-nya sendiri; bila bertentangan dengan sandi
  // yang dipilih, salah satunya keliru dan laporan akan menempatkan sertifikat pada baris yang salah.
  const mismatch = certificateNumberMismatch(input.certificateNumber, input.competencyCode);
  if (mismatch) throw new Error(mismatch);

  const db = await databaseOrThrow();
  const [inserted] = await db.insert(employeeCertifications).values({
    employeeId: input.employeeId,
    competencyCode: input.competencyCode,
    certificateNumber: input.certificateNumber?.trim() || null,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt ?? null,
    documentId: input.documentId ?? null,
    notes: input.notes?.trim() || null,
    createdByUserId: actor.id,
  }).$returningId();
  await writeAudit({ actorUserId: actor.id, action: "EMPLOYEE_CERTIFICATION_RECORDED", entityType: "employee_certifications", entityId: String(inserted.id), afterState: { employeeId: input.employeeId, competencyCode: input.competencyCode } });
  return inserted;
}

export async function assignPicRole(
  input: { employeeId: number; picRole: PicRole; assignedAt: Date; decreeNumber?: string; decreeAt?: Date; documentId?: number; notes?: string },
  actor: { id: number },
) {
  const db = await databaseOrThrow();
  const [inserted] = await db.insert(employeePicAssignments).values({
    employeeId: input.employeeId,
    picRole: input.picRole,
    decreeNumber: input.decreeNumber?.trim() || null,
    decreeAt: input.decreeAt ?? null,
    documentId: input.documentId ?? null,
    assignedAt: input.assignedAt,
    notes: input.notes?.trim() || null,
    createdByUserId: actor.id,
  }).$returningId();
  await writeAudit({ actorUserId: actor.id, action: "EMPLOYEE_PIC_ASSIGNED", entityType: "employee_pic_assignments", entityId: String(inserted.id), afterState: { employeeId: input.employeeId, picRole: input.picRole } });
  return inserted;
}

export async function setCompetencyPlan(
  input: { periodYear: number; periodQuarter: number; competencyCode: string; plannedCount: number; plannedBudgetIdr?: string; notes?: string },
  actor: { id: number },
) {
  const db = await databaseOrThrow();
  const existing = (await db.select({ id: sdmCompetencyPlans.id }).from(sdmCompetencyPlans).where(and(
    eq(sdmCompetencyPlans.periodYear, input.periodYear),
    eq(sdmCompetencyPlans.periodQuarter, input.periodQuarter),
    eq(sdmCompetencyPlans.competencyCode, input.competencyCode),
  )).limit(1))[0];

  const values = {
    periodYear: input.periodYear, periodQuarter: input.periodQuarter, competencyCode: input.competencyCode,
    plannedCount: input.plannedCount, plannedBudgetIdr: input.plannedBudgetIdr ?? null,
    notes: input.notes?.trim() || null, updatedByUserId: actor.id,
  };
  if (existing) await db.update(sdmCompetencyPlans).set(values).where(eq(sdmCompetencyPlans.id, existing.id));
  else await db.insert(sdmCompetencyPlans).values(values);
  await writeAudit({ actorUserId: actor.id, action: "SDM_PLAN_SET", entityType: "sdm_competency_plans", entityId: `${input.periodYear}-Q${input.periodQuarter}-${input.competencyCode}`, afterState: values });
}

/**
 * Menyusun laporan RAP01/RAS01 untuk satu triwulan langsung dari catatan pegawai.
 *
 * Angka tidak pernah diketik ulang di sini. Temuan pemeriksaan butir 5 memperlihatkan apa yang
 * terjadi ketika laporan disusun terpisah dari catatan internal: keduanya berbeda, dan selisihnya
 * baru ketahuan saat diperiksa.
 */
export async function buildSdmQuarterlyReport(input: { year: number; quarter: 1 | 2 | 3 | 4 }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const periodStart = quarterStartDate(input.year, input.quarter);
    const periodEnd = quarterEndDate(input.year, input.quarter);

    const [staff, certificates, plans] = await Promise.all([
      db.select().from(employees),
      db.select().from(employeeCertifications),
      db.select().from(sdmCompetencyPlans).where(and(
        eq(sdmCompetencyPlans.periodYear, input.year),
        eq(sdmCompetencyPlans.periodQuarter, input.quarter),
      )),
    ]);

    const forReport: EmployeeForReport[] = staff.map((row) => ({
      id: row.id,
      jobLevel: row.jobLevel,
      competencyLevel: row.competencyLevel,
      competencyTrack: row.competencyTrack,
      employmentStatus: row.employmentStatus,
      joinedAt: asIsoDate(row.joinedAt)!,
      endedAt: asIsoDate(row.endedAt),
    }));
    const certificationsForReport: CertificationForReport[] = certificates.map((row) => ({
      employeeId: row.employeeId,
      competencyCode: row.competencyCode,
      issuedAt: asIsoDate(row.issuedAt)!,
      expiresAt: asIsoDate(row.expiresAt),
    }));

    const rows = deriveSdmCounts({
      area: KUPVA_WORK_AREA,
      periodStart,
      periodEnd,
      employees: forReport,
      certifications: certificationsForReport,
      plans: Object.fromEntries(plans.map((plan) => [plan.competencyCode, plan.plannedCount])),
    });

    return { periodStart, periodEnd, form: formForPeriod(periodEnd), rows, problems: validateSdmReport(rows) };
  });
}

/** Berkas teks siap unggah; menolak menghasilkan berkas yang sudah diketahui bermasalah. */
export async function exportSdmTextFile(input: { year: number; quarter: 1 | 2 | 3 | 4; idPelapor: string }) {
  const report = await buildSdmQuarterlyReport(input);
  if (report.problems.length) throw new Error(`Laporan belum layak diunggah: ${report.problems.join(" ")}`);
  if (!input.idPelapor.trim()) throw new Error("Sandi pelapor belum diatur pada Profil Perusahaan.");
  return {
    fileName: `${report.form}_${input.idPelapor}_${report.periodEnd}.txt`,
    content: buildSdmTextFile({ idPelapor: input.idPelapor.trim(), periodeData: report.periodEnd, rows: report.rows }),
    form: report.form,
    periodEnd: report.periodEnd,
  };
}
