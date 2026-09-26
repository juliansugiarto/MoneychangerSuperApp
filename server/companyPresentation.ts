import { eq } from "drizzle-orm";
import { companyProfile } from "../drizzle/schema";
import { checkAppearance, type AppearanceInput } from "../shared/companyAppearance";
import { normalizePublicPage, type PublicPageInput } from "../shared/publicPage";
import { databaseOrThrow, getCompanyProfile, writeAudit } from "./operations";

/**
 * Penulis bagian "Tampilan" dan "Halaman publik" Profil Perusahaan. Terpisah dari
 * `updateCompanyProfile` supaya menyimpan satu bagian tidak pernah menimpa bagian lain, dan supaya
 * aturan yang sama dengan layar (`shared/`) ditegakkan ulang di server.
 */
const PROFILE_MISSING = "Profil perusahaan belum ada. Isi dan simpan Data badan usaha lebih dulu.";

async function existingProfileId(): Promise<number | null> {
  const db = await databaseOrThrow();
  const [row] = await db.select({ id: companyProfile.id }).from(companyProfile).orderBy(companyProfile.id).limit(1);
  return row?.id ?? null;
}

export async function updateCompanyAppearance(input: AppearanceInput, actor: { id: number }) {
  const checked = checkAppearance(input);
  if (!checked.ok) throw new Error(checked.error);
  const id = await existingProfileId();
  if (id === null) throw new Error(PROFILE_MISSING);
  const db = await databaseOrThrow();
  await db.update(companyProfile).set({ ...checked.values, updatedByUserId: actor.id }).where(eq(companyProfile.id, id));
  await writeAudit({ actorUserId: actor.id, action: "COMPANY_APPEARANCE_UPDATED", entityType: "company_profile", entityId: String(id), afterState: checked.values });
  return getCompanyProfile();
}

export async function updateCompanyPublicPage(input: PublicPageInput, actor: { id: number }) {
  const normalized = normalizePublicPage(input);
  if (!normalized.ok) throw new Error(normalized.error);
  const id = await existingProfileId();
  if (id === null) throw new Error(PROFILE_MISSING);
  const db = await databaseOrThrow();
  await db.update(companyProfile).set({ ...normalized.values, updatedByUserId: actor.id }).where(eq(companyProfile.id, id));
  await writeAudit({ actorUserId: actor.id, action: "COMPANY_PUBLIC_PAGE_UPDATED", entityType: "company_profile", entityId: String(id), afterState: normalized.values });
  return getCompanyProfile();
}
