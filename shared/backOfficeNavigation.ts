export type BackOfficeRole = "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER";

/** A leaf the sidebar can navigate to. Every one of these must have a matching <Route> in App.tsx. */
export type BackOfficeDestination = {
  label: string;
  path: string;
  minimumRole: BackOfficeRole;
};

/**
 * A sidebar row: either a leaf destination (`path`) or a parent that only expands (`children`).
 * Exactly one of the two is set — a parent never navigates, so clicking it can't be mistaken for
 * "go somewhere" when the user only meant to see what's underneath.
 */
export type BackOfficeNavigationEntry =
  | (BackOfficeDestination & { children?: never })
  | { label: string; children: BackOfficeDestination[]; path?: never; minimumRole?: never };

export type BackOfficeNavigationGroup = {
  label: string;
  items: BackOfficeNavigationEntry[];
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
    { label: "Pantauan Harian", path: "/operasional/monitoring", minimumRole: "CONTROLLER" },
  ] },
  { label: "Transaksi & Nasabah", items: [
    { label: "Buat Transaksi", path: "/operasional/transaksi", minimumRole: "STAFF" },
    { label: "Daftar Transaksi", path: "/operasional/transaksi/daftar", minimumRole: "STAFF" },
    { label: "Nasabah", children: [
      { label: "Nasabah Baru", path: "/operasional/nasabah", minimumRole: "STAFF" },
      { label: "Daftar Nasabah", path: "/operasional/nasabah/daftar", minimumRole: "STAFF" },
      { label: "Tambah dari Excel", path: "/operasional/impor-nasabah", minimumRole: "CONTROLLER" },
      { label: "Pemantauan Profil", path: "/operasional/nasabah/pemantauan", minimumRole: "CONTROLLER" },
    ] },
    { label: "Latihan (Tanpa Data Asli)", path: "/operasional/simulasi", minimumRole: "STAFF" },
  ] },
  { label: "Uang & Kurs", items: [
    { label: "Uang Kas", children: [
      { label: "Kas Awal Hari Ini", path: "/operasional/stock/kas-awal", minimumRole: "STAFF" },
      { label: "Sisa Uang Saat Ini", path: "/operasional/stock/saat-ini", minimumRole: "STAFF" },
      { label: "Hitung Fisik Uang", path: "/operasional/stock/opname", minimumRole: "STAFF" },
      { label: "Penyesuaian Brankas", path: "/operasional/stock/penyesuaian", minimumRole: "CONTROLLER" },
    ] },
    { label: "Kurs", children: [
      { label: "Kurs Hari Ini", path: "/operasional/kurs", minimumRole: "ADMIN" },
      { label: "Bandingkan Kurs", path: "/operasional/perbandingan-kurs", minimumRole: "ADMIN" },
    ] },
    { label: "Catat Pengeluaran", path: "/operasional/pengeluaran", minimumRole: "STAFF" },
  ] },
  { label: "Kegiatan Harian", items: [
    { label: "Buka & Tutup Outlet", path: "/operasional/checklist", minimumRole: "STAFF" },
    { label: "Meja Konfirmasi", path: "/operasional/layanan", minimumRole: "STAFF" },
    { label: "Keluhan Nasabah", path: "/operasional/pengaduan", minimumRole: "STAFF" },
    { label: "Cek Daftar DTTOT/DPPSPM", path: "/operasional/watchlist", minimumRole: "STAFF" },
  ] },
  { label: "Laporan", items: [
    { label: "Buku Besar", path: "/operasional/buku-besar", minimumRole: "CONTROLLER" },
    { label: "Laporan Keuangan", path: "/operasional/laporan-keuangan", minimumRole: "CONTROLLER" },
    { label: "Aset Tetap", path: "/operasional/aset-tetap", minimumRole: "CONTROLLER" },
    { label: "Laporan Transaksi", path: "/operasional/laporan", minimumRole: "CONTROLLER" },
    { label: "Laporan ke Regulator", path: "/operasional/pelaporan-regulator", minimumRole: "CONTROLLER" },
    { label: "Riwayat Aktivitas", path: "/operasional/audit", minimumRole: "CONTROLLER" },
  ] },
  { label: "Pengawasan", items: [
    { label: "Kepegawaian", path: "/operasional/kepegawaian", minimumRole: "CONTROLLER" },
    { label: "Status Kesiapan", path: "/operasional/kesiapan", minimumRole: "CONTROLLER" },
    { label: "Untuk Diketahui Direksi", path: "/operasional/pengawasan-direksi", minimumRole: "CONTROLLER" },
    { label: "Arsip Dokumen", path: "/operasional/arsip-dokumen", minimumRole: "CONTROLLER" },
    { label: "Klasifikasi Risiko", path: "/kepatuhan/klasifikasi-risiko", minimumRole: "CONTROLLER" },
    // ADMIN yang mengisi penilaian dan SHAREHOLDER yang menyetujuinya; keduanya harus melihat
    // barisnya. Halaman detailnya berparameter dan karena itu tidak menjadi tujuan sidebar.
    { label: "Penilaian Risiko (IRA)", path: "/kepatuhan/ira", minimumRole: "ADMIN" },
  ] },
  { label: "Pengaturan", items: [
    { label: "Pengguna & Hak Akses", path: "/operasional/pengguna", minimumRole: "CONTROLLER" },
    { label: "Profil Perusahaan", path: "/operasional/profil-perusahaan", minimumRole: "CONTROLLER" },
    { label: "Langkah Persiapan Awal", path: "/operasional/go-live", minimumRole: "CONTROLLER" },
  ] },
];

/** Every navigable leaf, parents flattened away — the set that must each have a route. */
export const backOfficeDestinations: BackOfficeDestination[] = backOfficeNavigationGroups.flatMap((group) =>
  group.items.flatMap((item) => (item.children ? item.children : [item])),
);

export function isRoleAllowed(role: BackOfficeRole, minimumRole: BackOfficeRole) {
  return roleRank[role] >= roleRank[minimumRole];
}

/**
 * A parent is visible when at least one child is — its own authority is derived from the children
 * rather than stored, so a parent can never drift into advertising a section the role cannot open.
 */
export function visibleBackOfficeNavigation(role: BackOfficeRole): BackOfficeNavigationGroup[] {
  return backOfficeNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): BackOfficeNavigationEntry[] => {
        if (!item.children) return isRoleAllowed(role, item.minimumRole) ? [item] : [];
        const children = item.children.filter((child) => isRoleAllowed(role, child.minimumRole));
        return children.length ? [{ label: item.label, children }] : [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat leaf paths a role can reach, in sidebar order — used by tests and access checks. */
export function visibleBackOfficeDestinations(role: BackOfficeRole): string[] {
  return visibleBackOfficeNavigation(role)
    .flatMap((group) => group.items)
    .flatMap((item) => (item.children ? item.children.map((child) => child.path) : [item.path]));
}
