import {
  ArrowLeftRight, BadgeDollarSign, Banknote, BookOpenText, Building2, ChartNoAxesCombined, ClipboardCheck,
  ClipboardList, FileArchive, FileSearch, FileText, Gauge, Landmark, LayoutDashboard, MessageSquareWarning,
  MessagesSquare, Receipt, Rocket, Scale, ShieldAlert, ShieldCheck, ShieldQuestion, UserPlus, UsersRound,
  Vault, Wallet, type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "/operasional": LayoutDashboard,
  "/operasional/checklist": ClipboardCheck,
  "/operasional/layanan": MessagesSquare,
  "/operasional/monitoring": Gauge,
  "/operasional/transaksi": ArrowLeftRight,
  "/operasional/transaksi/daftar": ClipboardList,
  "/operasional/pengeluaran": Receipt,
  "/operasional/simulasi": ShieldQuestion,
  "/operasional/stock/kas-awal": Banknote,
  "/operasional/stock/saat-ini": Wallet,
  "/operasional/stock/opname": ClipboardCheck,
  "/operasional/stock/penyesuaian": Vault,
  "/operasional/kurs": BadgeDollarSign,
  "/operasional/perbandingan-kurs": ChartNoAxesCombined,
  "/operasional/nasabah": UserPlus,
  "/operasional/nasabah/daftar": UsersRound,
  "/operasional/watchlist": ShieldAlert,
  "/operasional/pengaduan": MessageSquareWarning,
  "/operasional/impor-nasabah": FileSearch,
  "/operasional/nasabah/pemantauan": Gauge,
  "/kepatuhan/klasifikasi-risiko": Scale,
  "/kepatuhan/ira": ShieldCheck,
  "/operasional/laporan": ChartNoAxesCombined,
  "/operasional/buku-besar": BookOpenText,
  "/operasional/laporan-keuangan": FileText,
  "/operasional/aset-tetap": Building2,
  "/operasional/audit": FileSearch,
  "/operasional/pelaporan-regulator": Landmark,
  "/operasional/arsip-dokumen": FileArchive,
  "/kepatuhan/penatausahaan-dokumen": FileArchive,
  "/operasional/pengawasan-direksi": ShieldCheck,
  "/operasional/kesiapan": ShieldCheck,
  "/operasional/kepegawaian": UsersRound,
  "/operasional/pengguna": UsersRound,
  "/operasional/profil-perusahaan": Building2,
  "/operasional/go-live": Rocket,
};

const parentIcons: Record<string, LucideIcon> = { "Uang Kas": Wallet, Kurs: BadgeDollarSign };

export const iconFor = (path: string): LucideIcon => icons[path] ?? LayoutDashboard;
export const parentIconFor = (label: string): LucideIcon => parentIcons[label] ?? LayoutDashboard;
