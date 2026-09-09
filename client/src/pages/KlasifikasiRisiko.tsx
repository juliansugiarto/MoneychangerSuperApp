import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { IRA_DEFAULT_BAND_UPPER_BOUNDS, IRA_PARAMETERS } from "@shared/iraParameters";
import {
  IRA_LEGAL_FORM_LABELS,
  IRA_OCCUPATION_CATEGORY_LABELS,
  IRA_PROVINCE_LABELS,
} from "@shared/iraVocabulary";
import { AlertTriangle, RotateCcw, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Pemeliharaan klasifikasi risiko inheren dan ambang pita penilaian.
 *
 * Halaman ini **tidak menilai apa pun** — ia hanya menyimpan keputusan manusia beserta rujukannya.
 * Kode yang belum diklasifikasikan ditampilkan lebih dulu beserta hitungannya: ketiadaan
 * klasifikasi dibaca sebagai RENDAH oleh penilaian, dan pembacaan itu hanya sah bila seseorang
 * benar-benar memutuskannya, bukan karena barisnya belum sempat diisi.
 */

const DIMENSIONS = [
  { key: "CURRENCY", label: "Mata uang", hint: "Kode mata uang yang terdaftar pada aplikasi." },
  { key: "OCCUPATION", label: "Kategori pekerjaan", hint: "Kosakata tertutup Form C1." },
  { key: "LEGAL_FORM", label: "Bentuk badan hukum", hint: "Kosakata tertutup Form C1." },
  { key: "COUNTRY", label: "Negara", hint: "Kode ISO dua huruf; ditambahkan mengikuti daftar FATF dan sanksi PBB." },
  { key: "PROVINCE", label: "Provinsi", hint: "34 provinsi sebagaimana tertulis pada template." },
] as const;

type Dimension = (typeof DIMENSIONS)[number]["key"];
type RiskType = "TPPU" | "TPPT" | "PPSPM";
type RiskLevel = "RENDAH" | "MENENGAH" | "TINGGI";

const RISK_TYPES: RiskType[] = ["TPPU", "TPPT", "PPSPM"];
const LEVELS: RiskLevel[] = ["RENDAH", "MENENGAH", "TINGGI"];

const LEVEL_TONE: Record<RiskLevel, string> = {
  RENDAH: "border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]",
  MENENGAH: "border-[#f0e2c4] bg-[#fdf9f0] text-[#8a6d2f]",
  TINGGI: "border-[#f0d6d6] bg-[#fdf6f6] text-[#9a4b4b]",
};

const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

type ClassificationRow = { dimension: string; code: string; riskType: string; level: string; sourceNote: string; updatedAt: string | Date };

export default function KlasifikasiRisiko() {
  const utils = trpc.useUtils();
  const [dimension, setDimension] = useState<Dimension>("CURRENCY");
  const [editing, setEditing] = useState<{ code: string; label: string } | null>(null);
  const [draftLevels, setDraftLevels] = useState<Record<RiskType, RiskLevel>>({ TPPU: "RENDAH", TPPT: "RENDAH", PPSPM: "RENDAH" });
  const [sourceNote, setSourceNote] = useState("");
  const [newCountry, setNewCountry] = useState("");

  const classifications = trpc.iraClassification.list.useQuery();
  const thresholds = trpc.iraClassification.thresholds.useQuery();
  const currencies = trpc.currencies.list.useQuery();

  const setClassification = trpc.iraClassification.set.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const setThresholds = trpc.iraClassification.setThresholds.useMutation({
    onSuccess: () => { toast.success("Ambang pita disimpan."); void utils.iraClassification.thresholds.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const resetThresholds = trpc.iraClassification.resetThresholds.useMutation({
    onSuccess: () => { toast.success("Ambang dikembalikan ke nilai template."); void utils.iraClassification.thresholds.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const rows = (classifications.data ?? []) as ClassificationRow[];
  const byKey = new Map(rows.map((row) => [`${row.dimension}|${row.code}|${row.riskType}`, row]));

  /** Kode yang berlaku pada dimensi terpilih. Negara tidak punya kosakata tertutup — yang tampil
   *  adalah negara yang sudah pernah diklasifikasikan, ditambah yang diketik petugas. */
  const codesFor = (key: Dimension): { code: string; label: string }[] => {
    if (key === "CURRENCY") return (currencies.data ?? []).map((currency: { code: string; name: string }) => ({ code: currency.code, label: currency.name }));
    if (key === "OCCUPATION") return Object.entries(IRA_OCCUPATION_CATEGORY_LABELS).map(([code, label]) => ({ code, label }));
    if (key === "LEGAL_FORM") return Object.entries(IRA_LEGAL_FORM_LABELS).map(([code, label]) => ({ code, label }));
    if (key === "PROVINCE") return Object.entries(IRA_PROVINCE_LABELS).map(([code, label]) => ({ code, label }));
    return [...new Set(rows.filter((row) => row.dimension === "COUNTRY").map((row) => row.code))].map((code) => ({ code, label: code }));
  };

  const codes = codesFor(dimension);
  const isClassified = (code: string) => RISK_TYPES.some((riskType) => byKey.has(`${dimension}|${code}|${riskType}`));
  // Yang belum diklasifikasikan lebih dulu: itu pekerjaan yang menunggu, bukan keadaan sah.
  const ordered = [...codes].sort((left, right) => Number(isClassified(left.code)) - Number(isClassified(right.code)) || left.code.localeCompare(right.code));
  const unclassifiedCount = codes.filter((entry) => !isClassified(entry.code)).length;

  const openEditor = (entry: { code: string; label: string }) => {
    setEditing(entry);
    setDraftLevels({
      TPPU: (byKey.get(`${dimension}|${entry.code}|TPPU`)?.level as RiskLevel) ?? "RENDAH",
      TPPT: (byKey.get(`${dimension}|${entry.code}|TPPT`)?.level as RiskLevel) ?? "RENDAH",
      PPSPM: (byKey.get(`${dimension}|${entry.code}|PPSPM`)?.level as RiskLevel) ?? "RENDAH",
    });
    setSourceNote(byKey.get(`${dimension}|${entry.code}|TPPU`)?.sourceNote ?? "");
  };

  const saveClassification = async () => {
    if (!editing) return;
    if (sourceNote.trim().length < 3) return toast.error("Alasan atau rujukan SRA wajib diisi — klasifikasi tanpa rujukan adalah angka tanpa asal.");
    try {
      for (const riskType of RISK_TYPES) {
        await setClassification.mutateAsync({ dimension, code: editing.code, riskType, level: draftLevels[riskType], sourceNote: sourceNote.trim() });
      }
      toast.success(`Klasifikasi ${editing.code} disimpan.`);
      setEditing(null);
      void utils.iraClassification.list.invalidate();
    } catch {
      // Pesannya sudah ditampilkan onError; dialognya sengaja dibiarkan terbuka agar isian tidak hilang.
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <p className="max-w-3xl text-sm leading-6 text-[#475569]">
          Klasifikasi ini adalah <b>keputusan manusia beserta rujukannya</b>, bukan hasil hitungan aplikasi. Kode yang
          belum diklasifikasikan dibaca penilaian sebagai <b>Rendah</b> — bacaan itu hanya sah bila seseorang benar-benar
          memutuskannya.
        </p>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><ShieldAlert className="size-5 text-[#5c8f53]" /> Klasifikasi risiko inheren</CardTitle>
          <CardDescription>Satu kode dapat berlainan tingkat pada TPPU, TPPT, dan PPSPM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DIMENSIONS.map((entry) => (
              <Button key={entry.key} type="button" size="sm" variant={dimension === entry.key ? "default" : "outline"} onClick={() => setDimension(entry.key)}>
                {entry.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-[#94a7bb]">{DIMENSIONS.find((entry) => entry.key === dimension)?.hint}</p>

          {dimension === "COUNTRY" ? (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#dce6f0] bg-[#f8fbfe] p-3">
              <div>
                <Label className="text-xs">Tambahkan kode negara (ISO 2 huruf)</Label>
                <Input className="mt-1 w-40" maxLength={2} value={newCountry} onChange={(event) => setNewCountry(event.target.value.toUpperCase())} placeholder="mis. IR" />
              </div>
              <Button type="button" size="sm" variant="outline" disabled={newCountry.trim().length !== 2} onClick={() => openEditor({ code: newCountry.trim(), label: newCountry.trim() })}>
                Klasifikasikan
              </Button>
            </div>
          ) : null}

          {/* `isPending`, bukan `isLoading`: di sela percobaan ulang React Query, `isLoading`
              bernilai false sementara datanya masih kosong, sehingga halaman jatuh ke tabel dan
              menampilkan seluruh kode sebagai "belum diklasifikasikan". Pada layar ini kekeliruan
              itu paling berbahaya — belum diklasifikasikan dibaca penilaian sebagai RENDAH. */}
          {classifications.isPending || currencies.isPending ? (
            <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
          ) : classifications.isError ? (
            <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Klasifikasi risiko gagal dimuat.</p>
              <p className="mt-1">{classifications.error.message}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void classifications.refetch()}>Coba lagi</Button>
            </div>
          ) : ordered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbd9e7] bg-[#f8fbfe] px-5 py-10 text-center text-sm leading-6 text-[#475569]">
              {dimension === "COUNTRY"
                ? "Belum ada negara yang diklasifikasikan. Tambahkan kode negaranya lebih dulu di atas."
                : "Belum ada kode pada dimensi ini. Daftarkan mata uangnya lebih dulu pada Kas & Persediaan."}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-[#e2eaf2] bg-[#fbfdff] px-4 py-2.5 text-sm">
                <span className="text-[#475569]">{codes.length} kode pada dimensi ini</span>
                <Badge variant="outline" className={unclassifiedCount > 0 ? "border-[#f0e2c4] bg-[#fdf9f0] text-[#8a6d2f]" : "border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]"}>
                  {unclassifiedCount > 0 ? `${unclassifiedCount} belum diklasifikasikan` : "Seluruhnya sudah diklasifikasikan"}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                    <tr><th className="px-3 py-3">Kode</th><th className="px-3 py-3">Nama</th><th className="px-3 py-3">TPPU</th><th className="px-3 py-3">TPPT</th><th className="px-3 py-3">PPSPM</th><th className="px-3 py-3">Terakhir disunting</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f5]">
                    {ordered.map((entry) => (
                      <tr key={entry.code} className="cursor-pointer align-top hover:bg-[#f9fbff]" onClick={() => openEditor(entry)}>
                        <td className="px-3 py-3 font-semibold whitespace-nowrap text-[#18395f]">{entry.code}</td>
                        <td className="px-3 py-3 text-[#475569]">{entry.label}</td>
                        {RISK_TYPES.map((riskType) => {
                          const row = byKey.get(`${dimension}|${entry.code}|${riskType}`);
                          return (
                            <td key={riskType} className="px-3 py-3">
                              {row
                                ? <Badge variant="outline" className={LEVEL_TONE[row.level as RiskLevel]}>{row.level}</Badge>
                                : <span className="text-xs text-[#94a7bb]">belum</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-[#475569]">{formatDateTime(byKey.get(`${dimension}|${entry.code}|TPPU`)?.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]"><SlidersHorizontal className="size-5 text-[#5c8f53]" /> Ambang pita parameter</CardTitle>
          <CardDescription>
            33 parameter, lima pita masing-masing. <b>Skalanya terbalik</b>: pita terendah bernilai 5 (Rendah), pita
            teratas bernilai 1 (Tinggi). Pita teratas selalu tanpa batas atas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {thresholds.isPending ? (
            <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
          ) : thresholds.isError ? (
            <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Ambang pita gagal dimuat.</p>
              <p className="mt-1">{thresholds.error.message}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void thresholds.refetch()}>Coba lagi</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                  <tr>
                    <th className="px-3 py-3">Parameter</th>
                    {[1, 2, 3, 4].map((band) => <th key={band} className="px-3 py-3">Pita {band} (≤ %)</th>)}
                    <th className="px-3 py-3">Pita 5</th>
                    <th className="px-3 py-3">Terakhir</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f5]">
                  {IRA_PARAMETERS.map((parameter) => {
                    const row = (thresholds.data ?? []).find((entry: { parameterCode: string }) => entry.parameterCode === parameter.code);
                    const bounds = row?.upperBoundPercent ?? IRA_DEFAULT_BAND_UPPER_BOUNDS;
                    return (
                      <tr key={parameter.code} className="align-top">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[#18395f]">{parameter.code}</p>
                          <p className="text-xs text-[#475569]">{parameter.label}</p>
                          <Badge variant="outline" className="mt-1 border-[#dce6f0] bg-[#f7fafd] text-[10px] text-[#4a6a8f]">{parameter.source === "HITUNG" ? "dihitung" : "dinyatakan penilai"}</Badge>
                        </td>
                        {[0, 1, 2, 3].map((index) => (
                          <td key={index} className="px-3 py-3">
                            <Input
                              // `key` memuat nilainya supaya ruas ini dipasang ulang ketika ambang
                              // berubah dari luar — mengembalikan ke template menyimpan nilai baru,
                              // dan ruas tak terkendali yang tidak dipasang ulang akan terus
                              // menampilkan angka lama yang berbeda dari isi basis data.
                              key={`${parameter.code}-${index}-${bounds[index] ?? ""}`}
                              className="w-24"
                              inputMode="decimal"
                              defaultValue={bounds[index] ?? ""}
                              onBlur={(event) => {
                                const next = [...bounds];
                                next[index] = event.target.value.trim() || null;
                                if (next[index] === bounds[index]) return;
                                setThresholds.mutate({ parameterCode: parameter.code, upperBoundPercent: next as (string | null)[] });
                              }}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-3 text-xs text-[#94a7bb]">tanpa batas</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-[#475569]">
                          {row?.isTemplateDefault ? <span className="text-[#94a7bb]">bawaan template</span> : formatDateTime(row?.updatedAt)}
                        </td>
                        <td className="px-3 py-3">
                          <Button type="button" size="sm" variant="outline" disabled={row?.isTemplateDefault || resetThresholds.isPending} onClick={() => resetThresholds.mutate({ parameterCode: parameter.code })}>
                            <RotateCcw className="mr-1 size-3" />Template
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-[#18395f]">{editing.code}</DialogTitle>
                <DialogDescription>{editing.label}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {RISK_TYPES.map((riskType) => (
                  <div key={riskType}>
                    <Label className="text-xs">{riskType}</Label>
                    <Select value={draftLevels[riskType]} onValueChange={(value) => setDraftLevels({ ...draftLevels, [riskType]: value as RiskLevel })}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
                <div>
                  <Label className="text-xs">Alasan / rujukan SRA (wajib)</Label>
                  <Textarea className="mt-1" rows={3} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="Contoh: SRA 2024 — USD peringkat teratas nilai transaksi valas." />
                  <p className="mt-1 text-xs text-[#94a7bb]">Tercatat pada jejak audit bersama nilai lama dan nilai barunya.</p>
                </div>
                <Button type="button" className="w-full bg-[#183f70]" disabled={setClassification.isPending} onClick={() => void saveClassification()}>
                  {setClassification.isPending ? "Menyimpan…" : "Simpan klasifikasi"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
