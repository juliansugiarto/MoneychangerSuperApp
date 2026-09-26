import { eq } from "drizzle-orm";
import { operationalDocuments, type CompanyProfile } from "../drizzle/schema";
import { isSafeMapUrl, type PublicFaqItem } from "../shared/publicPage";
import { DEFAULT_PALETTE_ID } from "../shared/themePalettes";
import { isSetupRequired } from "./installationSetup";
import { databaseOrThrow, getCompanyProfile } from "./operations";
import { storageGetSignedUrl } from "./storage";

/**
 * Satu-satunya jalan data Profil Perusahaan ke pengunjung tanpa akun. Daftar kuncinya dipaku uji;
 * menambah kunci berarti mengubah uji itu dengan sadar. Nomor izin, NPWP, kode BI/PPATK/goAML, dan
 * email tidak pernah keluar lewat sini.
 */
export const PUBLIC_PROFILE_KEYS = [
  "tradingName", "address", "phone", "secondaryPhone", "openingHours", "mapUrl", "publicFaq", "fraudWarning",
  "themePalette", "accentColor", "publicPageEnabled", "logoUrl", "setupRequired",
] as const;

export type PublicProfile = {
  tradingName: string | null;
  address: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
  themePalette: string;
  accentColor: string | null;
  publicPageEnabled: boolean;
  logoUrl: string | null;
  setupRequired: boolean;
};

export function toPublicProfile(row: CompanyProfile | null, logoUrl: string | null, setupRequired: boolean): PublicProfile {
  return {
    tradingName: row?.tradingName?.trim() || row?.legalEntityName?.trim() || null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    secondaryPhone: row?.secondaryPhone ?? null,
    openingHours: row?.openingHours ?? null,
    mapUrl: row?.mapUrl && isSafeMapUrl(row.mapUrl) ? row.mapUrl : null,
    publicFaq: row?.publicFaq ?? null,
    fraudWarning: row?.fraudWarning ?? null,
    themePalette: row?.themePalette ?? DEFAULT_PALETTE_ID,
    accentColor: row?.accentColor ?? null,
    publicPageEnabled: row?.publicPageEnabled ?? true,
    logoUrl,
    setupRequired,
  };
}

export function isPublicLogo(document: { documentType: string; deactivatedAt: Date | null } | undefined): boolean {
  return Boolean(document && document.documentType === "COMPANY_LOGO" && !document.deactivatedAt);
}

async function publicLogoUrl(documentId: number | null): Promise<string | null> {
  if (!documentId) return null;
  const db = await databaseOrThrow();
  const [document] = await db.select({
    documentType: operationalDocuments.documentType,
    deactivatedAt: operationalDocuments.deactivatedAt,
    storageKey: operationalDocuments.storageKey,
  }).from(operationalDocuments).where(eq(operationalDocuments.id, documentId)).limit(1);
  if (!isPublicLogo(document)) return null;
  return storageGetSignedUrl(document.storageKey);
}

export async function readPublicProfile(deps: {
  getProfile: () => Promise<CompanyProfile | null>;
  setupRequired: () => Promise<boolean>;
  logoUrl: (documentId: number | null) => Promise<string | null>;
} = { getProfile: getCompanyProfile, setupRequired: isSetupRequired, logoUrl: publicLogoUrl }): Promise<PublicProfile> {
  const [row, setupRequired] = await Promise.all([deps.getProfile(), deps.setupRequired()]);
  // Penyimpanan berkas yang belum diatur (lokal) atau sedang gangguan tidak boleh menjatuhkan halaman kurs.
  const logoUrl = await deps.logoUrl(row?.logoDocumentId ?? null).catch(() => null);
  return toPublicProfile(row, logoUrl, setupRequired);
}
