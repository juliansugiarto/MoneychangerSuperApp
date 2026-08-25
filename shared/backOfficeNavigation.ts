export type BackOfficeRole = "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER";

export type BackOfficeDestination = {
  label: string;
  path: string;
  minimumRole: BackOfficeRole;
};

export type BackOfficeNavigationGroup = {
  label: string;
  items: BackOfficeDestination[];
};

export const roleRank: Record<BackOfficeRole, number> = {
  STAFF: 1,
  ADMIN: 2,
  CONTROLLER: 3,
  SHAREHOLDER: 4,
};

export const backOfficeNavigationGroups: BackOfficeNavigationGroup[] = [
  { label: "Ringkasan", items: [
    { label: "Hari Ini", path: "/operasional", minimumRole: "STAFF" },
    { label: "Monitoring", path: "/operasional/monitoring", minimumRole: "CONTROLLER" },
  ] },
  { label: "Layanan & Transaksi", items: [
    { label: "Bon Transaksi", path: "/operasional/transaksi", minimumRole: "STAFF" },
    { label: "Simulasi Aman", path: "/operasional/simulasi", minimumRole: "STAFF" },
    { label: "Permintaan Layanan", path: "/operasional/layanan", minimumRole: "STAFF" },
    { label: "Nasabah", path: "/operasional/nasabah", minimumRole: "STAFF" },
  ] },
  { label: "Kontrol Outlet", items: [
    { label: "Buka & Tutup Outlet", path: "/operasional/checklist", minimumRole: "STAFF" },
    { label: "Kurs Operasional", path: "/operasional/kurs", minimumRole: "ADMIN" },
    { label: "Bandingkan Kurs", path: "/operasional/perbandingan-kurs", minimumRole: "ADMIN" },
    { label: "Kas & Persediaan", path: "/operasional/stock", minimumRole: "STAFF" },
    { label: "Keluhan Nasabah", path: "/operasional/pengaduan", minimumRole: "STAFF" },
  ] },
  { label: "Pengawasan", items: [
    { label: "Kesiapan Operasional", path: "/operasional/kesiapan", minimumRole: "CONTROLLER" },
    { label: "Direksi Mengetahui", path: "/operasional/pengawasan-direksi", minimumRole: "CONTROLLER" },
    { label: "Mulai Go-Live", path: "/operasional/go-live", minimumRole: "CONTROLLER" },
    { label: "Laporan", path: "/operasional/laporan", minimumRole: "CONTROLLER" },
    { label: "Pelaporan Regulator", path: "/operasional/pelaporan-regulator", minimumRole: "CONTROLLER" },
    { label: "Jejak Audit", path: "/operasional/audit", minimumRole: "CONTROLLER" },
    { label: "Impor Nasabah", path: "/operasional/impor-nasabah", minimumRole: "CONTROLLER" },
    { label: "Akses Staf", path: "/operasional/pengguna", minimumRole: "CONTROLLER" },
  ] },
];

export const backOfficeDestinations = backOfficeNavigationGroups.flatMap((group) => group.items);

export function isRoleAllowed(role: BackOfficeRole, minimumRole: BackOfficeRole) {
  return roleRank[role] >= roleRank[minimumRole];
}

export function visibleBackOfficeNavigation(role: BackOfficeRole) {
  return backOfficeNavigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => isRoleAllowed(role, item.minimumRole)) }))
    .filter((group) => group.items.length > 0);
}
