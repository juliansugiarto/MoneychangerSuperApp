import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, FileText, SearchCheck, WalletCards } from "lucide-react";
import TransactionCreate from "./TransactionCreate";

const steps = [
  { icon: SearchCheck, number: "1", title: "Nomor kwitansi & nasabah", detail: "Isi nomor kwitansi fisik, lalu cari nama, CIF, atau identitas nasabah. Bila belum ada, buat KYC terlebih dahulu." },
  { icon: WalletCards, number: "2", title: "Baris mata uang & harga", detail: "Tambah satu baris per mata uang atau per pecahan berharga beda, isi nominal dan harga manual." },
  { icon: FileText, number: "3", title: "Simpan, arsip, kirim", detail: "Buat draft, cetak kwitansi, lalu kirim ke alur persetujuan. Arsip bon nyata ada di Daftar Transaksi." },
];

export default function GuidedTransactions() {
  return <div className="space-y-6"><Card className="mx-auto max-w-4xl border-[#d8e7df] bg-[#f8fcf8]"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase">Panduan kasir</p><h2 className="mt-1 font-display text-xl text-[#18395f]">Ikuti tiga langkah ini, satu per satu.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">Jangan membuat transaksi sebelum nasabah dan nomor kwitansi diisi. Jika ada indikator risiko atau dokumen underlying, ikuti permintaan sistem dan minta bantuan Supervisor bila ragu.</p></div><Badge className="w-fit status-approved"><CheckCircle2 className="mr-1 size-3" />ALUR SEDERHANA</Badge></div><ol className="mt-5 grid gap-3 md:grid-cols-3">{steps.map(({ icon: Icon, number, title, detail }) => <li key={number} className="rounded-xl border border-[#dbe9df] bg-white p-4"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-[#e9f5e7] text-xs font-bold text-[#397248]">{number}</span><Icon className="size-4 text-[#3f9276]" /><h3 className="text-sm font-bold text-[#294665]">{title}</h3></div><p className="mt-2 text-xs leading-5 text-[#64748b]">{detail}</p></li>)}</ol><p className="mt-4 rounded-xl border border-[#d8e7df] bg-white px-4 py-3 text-xs leading-5 text-[#526c84]"><strong>Arsip bon nyata:</strong> buka menu Daftar Transaksi lalu gunakan ikon printer untuk membuka arsip bon operasional. Pada dialog perangkat, pilih <strong>Simpan sebagai PDF</strong> atau printer fisik. Hasil Simulasi Aman tidak pernah masuk daftar ini.</p></CardContent></Card><TransactionCreate /></div>;
}
