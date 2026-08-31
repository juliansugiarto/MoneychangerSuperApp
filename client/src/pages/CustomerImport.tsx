import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import { useState } from "react";
import { toast } from "sonner";

type CustomerImportRow = {
  cifNumber: string;
  fullName: string;
  phoneNumber: string;
  identityType: "KTP" | "PASSPORT" | "OTHER";
  identityNumber: string;
  identityExpiryDate: Date;
  placeOfBirth: string;
  dateOfBirth: Date;
  address: string;
  occupation: string;
  sourceOfFunds: string;
  transactionPurpose: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  riskNotes?: string;
};

const templateHeaders = ["CIF", "NAMA LENGKAP", "TELEPON", "JENIS IDENTITAS", "NOMOR IDENTITAS", "BERLAKU HINGGA", "TEMPAT LAHIR", "TANGGAL LAHIR", "ALAMAT", "PEKERJAAN", "SUMBER DANA", "TUJUAN TRANSAKSI", "RISIKO", "CATATAN RISIKO"];

const fieldAliases = {
  cifNumber: ["cif", "cifnumber", "nomorcif"],
  fullName: ["namalengkap", "nama", "fullname"],
  phoneNumber: ["telepon", "nohp", "nomorhp", "phonenumber"],
  identityType: ["jenisidentitas", "tipeidentitas", "identitytype"],
  identityNumber: ["nomoridentitas", "noidentitas", "identitynumber"],
  identityExpiryDate: ["berlakuhingga", "masa berlaku", "identityexpirydate"],
  placeOfBirth: ["tempatlahir", "placeofbirth"],
  dateOfBirth: ["tanggallahir", "dateofbirth"],
  address: ["alamat", "address"],
  occupation: ["pekerjaan", "occupation"],
  sourceOfFunds: ["sumberdana", "sourceoffunds"],
  transactionPurpose: ["tujuantransaksi", "transactionpurpose"],
  riskLevel: ["risiko", "risklevel"],
  riskNotes: ["catatanrisiko", "risknotes"],
} as const;

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueAt(row: unknown[], index: number | undefined) {
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

function dateAt(row: unknown[], index: number | undefined, label: string) {
  const value = index === undefined ? null : row[index];
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} tidak valid.`);
  return parsed;
}

function headerIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseRows(raw: unknown[][]) {
  if (raw.length < 2) return { rows: [] as CustomerImportRow[], errors: ["File belum memiliki baris data."] };
  const headers = raw[0].map(normalize);
  const columns = Object.fromEntries(Object.entries(fieldAliases).map(([field, aliases]) => [field, headerIndex(headers, aliases)])) as Record<keyof typeof fieldAliases, number>;
  const required = Object.entries(columns).filter(([field, index]) => index < 0 && field !== "riskLevel" && field !== "riskNotes").map(([field]) => field);
  if (required.length) return { rows: [] as CustomerImportRow[], errors: [`Kolom wajib tidak ditemukan: ${required.join(", ")}. Gunakan template yang disediakan.`] };
  const rows: CustomerImportRow[] = [];
  const errors: string[] = [];
  raw.slice(1).forEach((rawRow, offset) => {
    const row = rawRow as unknown[];
    if (row.every((value) => String(value ?? "").trim() === "")) return;
    const line = offset + 2;
    try {
      const identityType = valueAt(row, columns.identityType).toUpperCase();
      if (!["KTP", "PASSPORT", "OTHER"].includes(identityType)) throw new Error("Jenis identitas harus KTP, PASSPORT, atau OTHER.");
      const riskValue = valueAt(row, columns.riskLevel).toUpperCase() || "LOW";
      if (!["LOW", "MEDIUM", "HIGH"].includes(riskValue)) throw new Error("Risiko harus LOW, MEDIUM, atau HIGH.");
      const customer: CustomerImportRow = {
        cifNumber: valueAt(row, columns.cifNumber), fullName: valueAt(row, columns.fullName), phoneNumber: valueAt(row, columns.phoneNumber),
        identityType: identityType as CustomerImportRow["identityType"], identityNumber: valueAt(row, columns.identityNumber), identityExpiryDate: dateAt(row, columns.identityExpiryDate, "Berlaku hingga"),
        placeOfBirth: valueAt(row, columns.placeOfBirth), dateOfBirth: dateAt(row, columns.dateOfBirth, "Tanggal lahir"), address: valueAt(row, columns.address),
        occupation: valueAt(row, columns.occupation), sourceOfFunds: valueAt(row, columns.sourceOfFunds), transactionPurpose: valueAt(row, columns.transactionPurpose),
        riskLevel: riskValue as CustomerImportRow["riskLevel"], riskNotes: valueAt(row, columns.riskNotes) || undefined,
      };
      const missing = ["cifNumber", "fullName", "phoneNumber", "identityNumber", "placeOfBirth", "address", "occupation", "sourceOfFunds", "transactionPurpose"].filter((key) => !String(customer[key as keyof CustomerImportRow] ?? "").trim());
      if (missing.length) throw new Error(`Data wajib kosong: ${missing.join(", ")}.`);
      rows.push(customer);
    } catch (error) {
      errors.push(`Baris ${line}: ${error instanceof Error ? error.message : "Data tidak dapat dibaca."}`);
    }
  });
  if (rows.length > 300) errors.push("Maksimal 300 baris nasabah per impor.");
  return { rows: rows.slice(0, 300), errors };
}

function downloadTemplate() {
  const example = ["CIF-001", "Nama Contoh", "081234567890", "KTP", "3203XXXX", "2030-12-31", "Cianjur", "1990-01-31", "Alamat lengkap", "Karyawan", "Gaji", "Perjalanan", "LOW", ""];
  const csv = [templateHeaders, example].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "template-impor-nasabah.csv"; anchor.click(); URL.revokeObjectURL(url);
}

export default function CustomerImport() {
  const utils = trpc.useUtils();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const importCustomers = trpc.customers.import.useMutation({
    onSuccess: (result) => { toast.success(`${result.insertedCount} nasabah berhasil diimpor.`); setRows([]); setErrors([]); setFileName(""); utils.customers.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const onFileChange = async (file?: File) => {
    setRows([]); setErrors([]); setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setErrors(["Gunakan file Excel berformat .xlsx. Untuk file lama .xls, simpan ulang terlebih dahulu sebagai .xlsx."]); return; }
    setReading(true);
    try {
      const raw = await readSheet(file);
      const result = parseRows(raw as unknown as unknown[][]);
      setRows(result.rows); setErrors(result.errors);
      if (!result.errors.length) toast.success(`${result.rows.length} baris siap ditinjau.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "File Excel tidak dapat dibaca."]);
    } finally {
      setReading(false);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-[1.5rem] border border-[#dce6f0] bg-white p-6 shadow-[0_10px_32px_rgba(30,50,87,0.05)] sm:p-8"><p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#5c8f53] uppercase"><FileSpreadsheet className="size-4" /> Pengawasan data</p><h1 className="mt-2 font-display text-3xl tracking-tight text-[#18395f]">Impor nasabah dengan pemeriksaan awal.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">Gunakan untuk memindahkan data nasabah yang sudah diperiksa. File dibaca untuk pratinjau; server memvalidasi ulang sebelum data benar-benar disimpan. Transaksi dan kas tidak akan berubah melalui halaman ini.</p></section>

    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="border-[#dce6f0]"><CardHeader><CardTitle className="font-display text-xl text-[#18395f]">1. Siapkan file</CardTitle><CardDescription>Ikuti urutan kolom template. Tanggal gunakan format `YYYY-MM-DD`, misalnya `2030-12-31`.</CardDescription></CardHeader><CardContent className="space-y-4"><Button variant="outline" onClick={downloadTemplate} className="w-full border-[#bfd2e5] text-[#183f70]"><Download className="mr-2 size-4" />Unduh template CSV untuk Excel</Button><div className="rounded-xl border border-dashed border-[#bcd0e3] bg-[#f7fbff] p-4"><Input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={reading} onChange={(event) => onFileChange(event.target.files?.[0])} /><p className="mt-3 text-xs leading-5 text-[#687d93]">Maksimal 300 nasabah per file. Data identitas ganda atau CIF yang sudah ada akan ditolak agar data aktif tidak tertimpa.</p></div>{fileName ? <p className="rounded-lg bg-[#eef6ed] px-3 py-2 text-xs text-[#417a4b]">File dipilih: <b>{fileName}</b></p> : null}</CardContent></Card>
      <Card className="border-[#dce6f0]"><CardHeader><CardTitle className="font-display text-xl text-[#18395f]">2. Tinjau sebelum impor</CardTitle><CardDescription>Pastikan tidak ada error. Hanya baris yang terlihat pada pratinjau yang akan dikirim untuk validasi akhir.</CardDescription></CardHeader><CardContent>{reading ? <div className="h-32 animate-pulse rounded-xl bg-[#f2f5f9]" /> : errors.length ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><div className="flex gap-2 text-sm font-semibold text-rose-800"><CircleAlert className="size-4" />Perbaiki file sebelum impor</div><ul className="mt-3 max-h-44 space-y-1 overflow-auto text-xs leading-5 text-rose-700">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : rows.length ? <div><div className="mb-4 flex items-center justify-between rounded-xl bg-[#eef6ed] p-3"><span className="flex items-center gap-2 text-sm font-semibold text-[#397248]"><CheckCircle2 className="size-4" />{rows.length} baris siap diimpor</span><Badge className="status-approved">VALIDASI AWAL LULUS</Badge></div><div className="overflow-x-auto rounded-xl border border-[#e2eaf2]"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#f5f8fc] text-xs uppercase text-[#587189]"><tr><th className="px-3 py-2">CIF</th><th className="px-3 py-2">Nasabah</th><th className="px-3 py-2">Identitas</th><th className="px-3 py-2">Risiko</th></tr></thead><tbody>{rows.slice(0, 10).map((row) => <tr className="border-t border-[#edf2f7]" key={`${row.cifNumber}-${row.identityNumber}`}><td className="px-3 py-2 font-medium text-[#294665]">{row.cifNumber}</td><td className="px-3 py-2">{row.fullName}</td><td className="px-3 py-2">{row.identityType} · {row.identityNumber}</td><td className="px-3 py-2"><Badge className="status-inactive">{row.riskLevel}</Badge></td></tr>)}</tbody></table></div>{rows.length > 10 ? <p className="mt-2 text-xs text-[#718397]">Menampilkan 10 dari {rows.length} baris yang siap diproses.</p> : null}<Button disabled={importCustomers.isPending} onClick={() => importCustomers.mutate({ rows })} className="press-scale mt-5 w-full bg-[#183f70] text-white hover:bg-[#12345d]"><Upload className="mr-2 size-4" />{importCustomers.isPending ? "Mengimpor nasabah…" : `Konfirmasi impor ${rows.length} nasabah`}</Button></div> : <div className="rounded-xl border border-dashed border-[#cddbe7] bg-[#f8fbfe] px-5 py-12 text-center"><ShieldCheck className="mx-auto size-6 text-[#6d9b73]" /><p className="mt-3 font-semibold text-[#405b76]">Belum ada file yang siap diproses.</p><p className="mt-1 text-sm text-[#718397]">Pilih file `.xlsx` untuk melihat pratinjau dan hasil validasi awal di sini.</p></div>}</CardContent></Card></div>
  </div>;
}
