import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  apuTrainingAttendance,
  apuTrainingSessions,
  employeeCertifications,
  employeePicAssignments,
  employeeProfileReviews,
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
  WORK_AREAS,
  buildRealisasiReport,
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
  type RealisasiTrack,
} from "../shared/sdmCompetency";
import { profileReviewStatus } from "../shared/employeeProfileReview";
import { databaseOrThrow, retryTransientDatabaseRead, writeAudit } from "./operations";

type JobLevel = (typeof jobLevels)[number];
type PicRole = (typeof picRoles)[number];
type CompetencyTrack = (typeof competencyTracks)[number];
type EmploymentStatus = (typeof employmentStatuses)[number];
type ScreeningResult = (typeof screeningResults)[number];
type TrainingMethod = "IN_HOUSE" | "EKSTERNAL" | "DARING";
type ProfileReviewOutcome = "TIDAK_ADA_PERUBAHAN" | "ADA_PERUBAHAN" | "PERLU_TINDAK_LANJUT";

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
  input: { periodYear: number; periodQuarter: number; competencyCode: string; plannedCount: number; plannedBudgetIdr?: string; realisasiBudgetIdr?: string; notes?: string },
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
    realisasiBudgetIdr: input.realisasiBudgetIdr ?? null,
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

/**
 * Menyusun Laporan Rencana Pemenuhan (Lampiran X/XI PADG 17/2024) untuk satu tahun.
 *
 * Berbeda dari RAP01/RAS01 yang melaporkan posisi per triwulan, lampiran ini adalah rencana
 * tahunan: jumlah SDM per jenjang, rencana PBK dan rencana pemeliharaan sertifikat untuk tiap
 * triwulan, serta dua total rencana penyediaan dana. Seluruhnya sudah tersimpan pada tabel rencana
 * dan catatan pegawai, jadi lampiran ini menyajikan ulang, bukan meminta pengetikan kedua kali.
 */
export async function buildAnnualSdmPlan(input: { year: number }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const [staff, plans] = await Promise.all([
      db.select().from(employees),
      db.select().from(sdmCompetencyPlans).where(eq(sdmCompetencyPlans.periodYear, input.year)),
    ]);

    const yearEnd = `${input.year}-12-31`;
    const activeAtYearEnd = staff.filter((row) =>
      row.employmentStatus === "AKTIF" &&
      asIsoDate(row.joinedAt)! <= yearEnd &&
      (!row.endedAt || asIsoDate(row.endedAt)! >= yearEnd));

    const planFor = (code: string, quarter: number) =>
      plans.find((plan) => plan.competencyCode === code && plan.periodQuarter === quarter);

    // Lampiran hanya mengenal tiga jenjang; PBK memang tidak memiliki sandi untuk direksi.
    const levels = [
      { level: 4 as const, name: "PELAKSANA", label: "Pelaksana" },
      { level: 3 as const, name: "PENYELIA", label: "Penyelia" },
      { level: 2 as const, name: "PEJABAT_EKSEKUTIF", label: "Pejabat Eksekutif" },
    ];

    const rows = levels.map((entry) => {
      const pbkCode = `PBKNK66SPP${KUPVA_WORK_AREA}${entry.level}`;
      const maintenanceCode = `PBKPK66SPP${KUPVA_WORK_AREA}${entry.level}`;
      const quarters = [1, 2, 3, 4] as const;
      return {
        ...entry,
        totalSdm: activeAtYearEnd.filter((row) => (row.competencyLevel ?? row.jobLevel) === entry.name).length,
        rencanaPbk: quarters.map((quarter) => planFor(pbkCode, quarter)?.plannedCount ?? 0),
        rencanaPemeliharaan: quarters.map((quarter) => planFor(maintenanceCode, quarter)?.plannedCount ?? 0),
      };
    });

    const budgetFor = (prefix: string) => plans
      .filter((plan) => plan.competencyCode.startsWith(prefix))
      .reduce((total, plan) => total + Number(plan.plannedBudgetIdr ?? 0), 0);

    return {
      year: input.year,
      // Masa peralihan berakhir 31 Desember 2026, jadi lampiran untuk tahun itu masih Lampiran XI.
      lampiran: formForPeriod(yearEnd) === "rap01" ? "XI" : "X",
      bidang: WORK_AREAS[KUPVA_WORK_AREA],
      rows,
      totalDanaPbk: budgetFor("PBKNK"),
      totalDanaPemeliharaan: budgetFor("PBKPK"),
    };
  });
}

/**
 * Laporan realisasi per triwulan (Lampiran X/XI bagian B.II untuk PBK, B.IV untuk Sertifikasi
 * Kompetensi), lengkap dengan realisasi penggunaan dana tahun berjalan.
 */
export async function buildSdmRealisasiReport(input: { year: number; quarter: 1 | 2 | 3 | 4; track: RealisasiTrack }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const periodStart = quarterStartDate(input.year, input.quarter);
    const periodEnd = quarterEndDate(input.year, input.quarter);

    const [staff, certificates, yearPlans] = await Promise.all([
      db.select().from(employees),
      db.select().from(employeeCertifications),
      db.select().from(sdmCompetencyPlans).where(eq(sdmCompetencyPlans.periodYear, input.year)),
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

    const report = buildRealisasiReport({
      track: input.track,
      area: KUPVA_WORK_AREA,
      periodStart,
      periodEnd,
      employees: forReport,
      certifications: certificationsForReport,
      plans: Object.fromEntries(yearPlans.filter((plan) => plan.periodQuarter === input.quarter).map((plan) => [plan.competencyCode, plan.plannedCount])),
    });

    // Dana dilaporkan sebagai realisasi tahun berjalan, jadi dijumlahkan sejak triwulan pertama
    // sampai triwulan pelaporan - bukan hanya triwulan ini.
    const spendUpTo = (prefix: string) => yearPlans
      .filter((plan) => plan.competencyCode.startsWith(prefix) && plan.periodQuarter <= input.quarter)
      .reduce((total, plan) => total + Number(plan.realisasiBudgetIdr ?? 0), 0);

    const spec = { PBK: { base: "PBKNK", maintenance: "PBKPK" }, KOMPETENSI: { base: "SKNK", maintenance: "SKPK" } }[input.track];
    return {
      ...report,
      year: input.year,
      quarter: input.quarter,
      realisasiDanaSertifikasi: spendUpTo(spec.base),
      realisasiDanaPemeliharaan: spendUpTo(spec.maintenance),
    };
  });
}

// ---------------------------------------------------------------------------
// Pelatihan APU PPT PPPSPM
// ---------------------------------------------------------------------------

export async function listTrainingSessions() {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const [sessions, attendance] = await Promise.all([
      db.select().from(apuTrainingSessions).orderBy(desc(apuTrainingSessions.heldAt)),
      db.select().from(apuTrainingAttendance),
    ]);
    return sessions.map((session) => ({
      ...session,
      attendeeIds: attendance.filter((row) => row.sessionId === session.id).map((row) => row.employeeId),
    }));
  });
}

export async function recordTrainingSession(
  input: { heldAt: Date; topic: string; method: TrainingMethod; facilitator: string; materials?: string; notes?: string; attendeeIds: number[] },
  actor: { id: number },
) {
  const topic = input.topic.trim();
  const facilitator = input.facilitator.trim();
  if (!topic || !facilitator) throw new Error("Topik dan pemateri pelatihan wajib diisi.");
  // Bukti yang diminta penilaian risiko adalah daftar hadir; pelatihan tanpa peserta tidak
  // membuktikan apa pun dan hanya akan menggelembungkan angka kepatuhan.
  if (!input.attendeeIds.length) throw new Error("Pilih minimal satu pegawai yang hadir.");

  const db = await databaseOrThrow();
  const [session] = await db.insert(apuTrainingSessions).values({
    heldAt: input.heldAt, topic, method: input.method, facilitator,
    materials: input.materials?.trim() || null,
    notes: input.notes?.trim() || null,
    createdByUserId: actor.id,
  }).$returningId();

  const unique = Array.from(new Set(input.attendeeIds));
  await db.insert(apuTrainingAttendance).values(unique.map((employeeId) => ({ sessionId: session.id, employeeId })));
  await writeAudit({ actorUserId: actor.id, action: "APU_TRAINING_RECORDED", entityType: "apu_training_sessions", entityId: String(session.id), afterState: { heldAt: input.heldAt, topic, attendees: unique.length } });
  return session;
}

/**
 * Rekapitulasi daftar hadir untuk satu rentang periode, sesuai lampiran Surat Keterangan
 * Pelaksanaan Pelatihan Internal: satu baris per pegawai berisi tanggal pelatihan terakhirnya.
 *
 * Pegawai aktif yang belum pernah mengikuti pelatihan tetap ditampilkan tanpa tanggal — justru
 * merekalah yang perlu terlihat, karena rekap yang hanya memuat peserta akan tampak lengkap.
 */
export async function buildTrainingRecap(input: { from: Date; to: Date }) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const [staff, sessions, attendance] = await Promise.all([
      db.select().from(employees).where(eq(employees.employmentStatus, "AKTIF")),
      db.select().from(apuTrainingSessions).where(and(gte(apuTrainingSessions.heldAt, input.from), lte(apuTrainingSessions.heldAt, input.to))),
      db.select().from(apuTrainingAttendance),
    ]);
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    const rows = staff.map((employee) => {
      const attended = attendance
        .filter((row) => row.employeeId === employee.id && sessionById.has(row.sessionId))
        .map((row) => sessionById.get(row.sessionId)!)
        .sort((a, b) => Number(new Date(b.heldAt)) - Number(new Date(a.heldAt)));
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        lastTrainedAt: attended[0] ? asIsoDate(attended[0].heldAt) : null,
        sessionCount: attended.length,
      };
    });

    return {
      from: asIsoDate(input.from)!,
      to: asIsoDate(input.to)!,
      rows,
      sessions: sessions.sort((a, b) => Number(new Date(a.heldAt)) - Number(new Date(b.heldAt))),
      untrained: rows.filter((row) => !row.lastTrainedAt).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Peninjauan berkala profil pegawai
// ---------------------------------------------------------------------------

/**
 * Jadwal peninjauan seluruh pegawai aktif, diurutkan dari yang paling terlambat.
 *
 * Yang belum pernah ditinjau dihitung dari tanggal masuk, sehingga pegawai lama yang profilnya
 * tidak pernah dikinikan muncul paling atas — persis keadaan yang menjadi temuan pemeriksaan.
 */
export async function buildProfileReviewSchedule(now = new Date()) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    const [staff, reviews] = await Promise.all([
      db.select().from(employees).where(eq(employees.employmentStatus, "AKTIF")),
      db.select().from(employeeProfileReviews).orderBy(desc(employeeProfileReviews.reviewedAt)),
    ]);

    const rows = staff.map((employee) => {
      const history = reviews.filter((review) => review.employeeId === employee.id);
      const latest = history[0] ?? null;
      const status = profileReviewStatus({
        joinedAt: new Date(employee.joinedAt),
        lastReviewedAt: latest ? new Date(latest.reviewedAt) : null,
        now,
      });
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        joinedAt: asIsoDate(employee.joinedAt),
        lastReviewedAt: latest ? asIsoDate(latest.reviewedAt) : null,
        lastOutcome: latest?.outcome ?? null,
        lastNotes: latest?.notes ?? null,
        reviewCount: history.length,
        dueAt: asIsoDate(status.dueAt)!,
        status: status.status,
        daysUntilDue: status.daysUntilDue,
        neverReviewed: status.neverReviewed,
      };
    });

    rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return {
      rows,
      overdue: rows.filter((row) => row.status === "TERLAMBAT").length,
      dueSoon: rows.filter((row) => row.status === "SEGERA").length,
      neverReviewed: rows.filter((row) => row.neverReviewed).length,
    };
  });
}

export async function recordProfileReview(
  input: { employeeId: number; reviewedAt: Date; outcome: ProfileReviewOutcome; notes?: string },
  actor: { id: number },
) {
  const notes = input.notes?.trim() || null;
  // Hasil selain "tidak ada perubahan" tanpa keterangan tidak dapat ditindaklanjuti siapa pun,
  // dan pada berkas pemeriksaan hanya akan terbaca sebagai peninjauan yang tidak selesai.
  if (input.outcome !== "TIDAK_ADA_PERUBAHAN" && !notes) {
    throw new Error("Jelaskan perubahan atau tindak lanjut yang ditemukan pada peninjauan ini.");
  }

  const db = await databaseOrThrow();
  const [employee] = await db.select().from(employees).where(eq(employees.id, input.employeeId));
  if (!employee) throw new Error("Pegawai tidak ditemukan.");
  if (employee.employmentStatus !== "AKTIF") throw new Error("Pegawai yang sudah tidak aktif tidak perlu ditinjau.");

  const [review] = await db.insert(employeeProfileReviews).values({
    employeeId: input.employeeId,
    reviewedAt: input.reviewedAt,
    outcome: input.outcome,
    notes,
    reviewedByUserId: actor.id,
  }).$returningId();

  await writeAudit({
    actorUserId: actor.id,
    action: "EMPLOYEE_PROFILE_REVIEWED",
    entityType: "employee_profile_reviews",
    entityId: String(review.id),
    afterState: { employeeId: input.employeeId, reviewedAt: input.reviewedAt, outcome: input.outcome },
  });
  return review;
}

export async function listProfileReviews(employeeId: number) {
  return retryTransientDatabaseRead(async () => {
    const db = await databaseOrThrow();
    return db.select().from(employeeProfileReviews)
      .where(eq(employeeProfileReviews.employeeId, employeeId))
      .orderBy(desc(employeeProfileReviews.reviewedAt));
  });
}
