import { useMemo, useRef, useState } from "react";
import { Building2, Coins, PackageMinus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const rupiah = (value: string) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(Number(value));

const CATEGORY_LABELS = {
  TANAH: "Tanah",
  BANGUNAN: "Bangunan",
  KENDARAAN: "Kendaraan",
  PERALATAN_KANTOR: "Peralatan kantor",
  PERANGKAT_KERAS: "Perangkat keras",
  PERANGKAT_LUNAK: "Perangkat lunak",
  INVENTARIS_LAIN: "Inventaris lain",
} as const;

type Category = keyof typeof CATEGORY_LABELS;

/**
 * Umur manfaat menurut kelompok penyusutan DJP (PMK 72/2023).
 *
 * Disalin sebagai konstanta klien, bukan diambil lewat prosedur: nilainya hanya mengisi sebuah
 * medan form dan tidak pernah dibaca server, sehingga mengambilnya lewat jaringan hanya menambah
 * satu permintaan tanpa menambah kebenaran. Server tetap memegang salinannya sendiri untuk
 * keperluannya sendiri.
 */
const TAX_GROUPS = [
  { value: "KELOMPOK_1", label: "Kelompok 1 — 4 tahun", months: 48 },
  { value: "KELOMPOK_2", label: "Kelompok 2 — 8 tahun", months: 96 },
  { value: "KELOMPOK_3", label: "Kelompok 3 — 16 tahun", months: 192 },
  { value: "KELOMPOK_4", label: "Kelompok 4 — 20 tahun", months: 240 },
  { value: "BANGUNAN_PERMANEN", label: "Bangunan permanen — 20 tahun", months: 240 },
  { value: "BANGUNAN_NON_PERMANEN", label: "Bangunan non-permanen — 10 tahun", months: 120 },
  { value: "TIDAK_DISUSUTKAN", label: "Tidak disusutkan (tanah)", months: null },
] as const;

export default function AsetTetap() {
  const assets = trpc.fixedAssets.list.useQuery();
  const settings = trpc.fixedAssets.settings.useQuery();
  const utils = trpc.useUtils();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [disposeFor, setDisposeFor] = useState<number | null>(null);
  const registerTrigger = useRef<HTMLButtonElement>(null);
  const disposeTrigger = useRef<HTMLButtonElement>(null);

  const refresh = () => {
    utils.fixedAssets.list.invalidate();
    utils.fixedAssets.settings.invalidate();
  };

  const register = trpc.fixedAssets.register.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.entryNumber
          ? `Aset terdaftar dan perolehannya dijurnal sebagai ${result.entryNumber}.`
          : "Aset warisan terdaftar; perolehannya tidak dijurnal dari sini.",
      );
      setRegisterOpen(false);
      registerTrigger.current?.focus();
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const dispose = trpc.fixedAssets.dispose.useMutation({
    onSuccess: (result) => {
      const gain = Number(result.gainLoss);
      toast.success(
        `Aset dilepas dan dijurnal sebagai ${result.entryNumber}. ${
          gain === 0 ? "Impas terhadap nilai bukunya." : gain > 0 ? `Laba ${rupiah(result.gainLoss)}.` : `Rugi ${rupiah(String(Math.abs(gain)))}.`
        }`,
      );
      setDisposeFor(null);
      disposeTrigger.current?.focus();
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const selected = useMemo(
    () => assets.data?.find((asset) => asset.id === disposeFor) ?? null,
    [assets.data, disposeFor],
  );

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#18395f]">Aset Tetap</h1>
          <p className="max-w-3xl text-sm text-[#475569]">
            Harga perolehan, akumulasi penyusutan, dan nilai buku setiap aset. Penyusutan bulanannya
            dijurnal dari tab <span className="font-semibold">Periode</span> pada halaman Buku Besar,
            sebelum periodenya ditutup.
          </p>
        </div>
        <Button ref={registerTrigger} onClick={() => setRegisterOpen(true)}>
          <Plus className="mr-2 size-4" />Daftarkan aset
        </Button>
      </div>

      <ThresholdCard settings={settings} />

      <Card className="border-[#dce6f0]">
        <CardHeader>
          <CardTitle className="font-display text-xl text-[#18395f]">Daftar aset</CardTitle>
          <CardDescription>
            Aset yang sudah habis disusutkan tetap terdaftar — barangnya masih ada, dan yang
            ditanyakan pemeriksa adalah asetnya, bukan nilai bukunya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : assets.isError ? (
            <div className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4">
              <p className="text-sm text-[#9a4b4b]">Daftar aset tidak dapat dimuat: {assets.error.message}</p>
              <Button className="mt-3" variant="outline" onClick={() => assets.refetch()}>Coba lagi</Button>
            </div>
          ) : !assets.data?.length ? (
            <div className="rounded-xl border border-dashed border-[#dce6f0] p-8 text-center">
              <Building2 className="mx-auto size-8 text-[#a9bdd4]" />
              <p className="mt-3 text-sm font-semibold text-[#213f63]">Belum ada aset tetap yang terdaftar.</p>
              <p className="mx-auto mt-1 max-w-lg text-sm text-[#718398]">
                Barang di bawah batas kapitalisasi dicatat sebagai beban lewat Catat Pengeluaran,
                bukan di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#8194aa]">
                  <tr className="border-b border-[#e6edf5]">
                    <th className="py-2 pr-4">Aset</th>
                    <th className="py-2 pr-4">Kategori</th>
                    <th className="py-2 pr-4">Perolehan</th>
                    <th className="py-2 pr-4 text-right">Harga perolehan</th>
                    <th className="py-2 pr-4 text-right">Akumulasi</th>
                    <th className="py-2 pr-4 text-right">Nilai buku</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {assets.data.map((asset) => (
                    <tr key={asset.id} className="border-b border-[#eef2f7]">
                      <td className="py-2 pr-4 font-semibold text-[#213f63]">
                        {asset.name}
                        {asset.assetCode ? <span className="ml-2 text-xs font-normal text-[#8194aa]">{asset.assetCode}</span> : null}
                        {asset.isLegacy ? (
                          <Badge className="ml-2 bg-[#f5f0e6] text-[#8a6320] hover:bg-[#f5f0e6]">Warisan</Badge>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-[#475569]">{CATEGORY_LABELS[asset.category as Category]}</td>
                      <td className="py-2 pr-4 text-[#475569]">{asset.acquisitionDate}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{rupiah(asset.acquisitionCost)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[#475569]">{rupiah(asset.accumulated)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-semibold text-[#213f63]">{rupiah(asset.carrying)}</td>
                      <td className="py-2 pr-4">
                        {asset.status === "DILEPAS" ? (
                          <Badge className="bg-[#eef3fb] text-[#405dbc] hover:bg-[#eef3fb]">Dilepas {asset.disposalDate}</Badge>
                        ) : (
                          <Badge className="bg-[#eef6ed] text-[#4d8548] hover:bg-[#eef6ed]">Aktif</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {asset.status === "AKTIF" ? (
                          <Button
                            ref={disposeFor === asset.id ? disposeTrigger : undefined}
                            variant="outline"
                            size="sm"
                            onClick={() => setDisposeFor(asset.id)}
                          >
                            <PackageMinus className="mr-1.5 size-3.5" />Lepaskan
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegisterDialog
        open={registerOpen}
        pending={register.isPending}
        onOpenChange={(open) => {
          setRegisterOpen(open);
          if (!open) registerTrigger.current?.focus();
        }}
        onSubmit={(values) => register.mutate(values)}
      />

      <DisposeDialog
        asset={selected}
        pending={dispose.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDisposeFor(null);
            disposeTrigger.current?.focus();
          }
        }}
        onSubmit={(values) => dispose.mutate(values)}
      />
    </div>
  );
}

function ThresholdCard({
  settings,
}: {
  settings: { data: { capitalisationThresholdIdr: string } | undefined; isLoading: boolean; isError: boolean; error: { message: string } | null };
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<string | null>(null);
  const update = trpc.fixedAssets.updateSettings.useMutation({
    onSuccess: (result) => {
      toast.success(`Batas kapitalisasi kini ${rupiah(result.capitalisationThresholdIdr)}.`);
      setDraft(null);
      utils.fixedAssets.settings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="border-[#dce6f0]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg text-[#18395f]">
          <Coins className="size-4" />Batas kapitalisasi
        </CardTitle>
        <CardDescription>
          Pengeluaran di bawah batas ini dicatat sebagai beban, bukan sebagai aset. Batasnya
          menentukan apa yang masuk neraca dan apa yang masuk laba rugi, jadi perubahannya tercatat
          pada jejak audit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : settings.isError ? (
          <p className="text-sm text-[#9a4b4b]">Batas tidak dapat dimuat: {settings.error?.message}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs" htmlFor="batas-kapitalisasi">Batas (Rupiah)</Label>
              <Input
                id="batas-kapitalisasi"
                className="mt-1 w-56 tabular-nums"
                inputMode="decimal"
                value={draft ?? settings.data?.capitalisationThresholdIdr ?? ""}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={update.isPending || draft === null || draft === settings.data?.capitalisationThresholdIdr}
              onClick={() => draft && update.mutate({ capitalisationThresholdIdr: draft })}
            >
              Simpan batas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type RegisterValues = {
  name: string;
  assetCode?: string;
  category: Category;
  taxGroup?: (typeof TAX_GROUPS)[number]["value"];
  acquisitionDate: string;
  acquisitionCost: string;
  residualValue?: string;
  usefulLifeMonths: number | null;
  firstJournalMonth?: string;
  openingAccumulatedDepreciation?: string;
  notes?: string;
};

function RegisterDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RegisterValues) => void;
}) {
  const [name, setName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [category, setCategory] = useState<Category>("PERALATAN_KANTOR");
  const [taxGroup, setTaxGroup] = useState<(typeof TAX_GROUPS)[number]["value"]>("KELOMPOK_1");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [residualValue, setResidualValue] = useState("0.00");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("48");
  const [legacy, setLegacy] = useState(false);
  const [firstJournalMonth, setFirstJournalMonth] = useState("");
  const [openingAccumulated, setOpeningAccumulated] = useState("0.00");
  const [notes, setNotes] = useState("");

  const isLand = category === "TANAH";

  const pickTaxGroup = (value: (typeof TAX_GROUPS)[number]["value"]) => {
    setTaxGroup(value);
    // Mengisi, bukan mengunci: SAK EP Bab 17 menuntut umur manfaat sebenarnya.
    const months = TAX_GROUPS.find((group) => group.value === value)?.months;
    setUsefulLifeMonths(months === null || months === undefined ? "" : String(months));
  };

  const pickCategory = (value: Category) => {
    setCategory(value);
    if (value === "TANAH") {
      setTaxGroup("TIDAK_DISUSUTKAN");
      setUsefulLifeMonths("");
    }
  };

  const submit = () =>
    onSubmit({
      name: name.trim(),
      assetCode: assetCode.trim() || undefined,
      category,
      taxGroup,
      acquisitionDate,
      acquisitionCost,
      residualValue: residualValue || undefined,
      usefulLifeMonths: isLand ? null : Number(usefulLifeMonths),
      firstJournalMonth: legacy && firstJournalMonth ? firstJournalMonth : undefined,
      openingAccumulatedDepreciation: legacy ? openingAccumulated : undefined,
      notes: notes.trim() || undefined,
    });

  const ready = name.trim() && acquisitionDate && acquisitionCost && (isLand || Number(usefulLifeMonths) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Daftarkan aset tetap</DialogTitle>
          <DialogDescription>
            Perolehan dijurnal ke Aset Tetap lawan Kewajiban Lain-Lain. Uangnya tidak keluar dari kas
            di sini; pelunasannya dicatat terpisah saat benar-benar dibayar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="aset-nama">Nama aset *</Label>
            <Input id="aset-nama" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mis. Brankas Chubb" />
          </div>
          <div>
            <Label htmlFor="aset-kode">Nomor inventaris</Label>
            <Input id="aset-kode" className="mt-1" value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder="Boleh dikosongkan" />
          </div>
          <div>
            <Label>Kategori *</Label>
            <Select value={category} onValueChange={(value) => pickCategory(value as Category)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="aset-tanggal">Tanggal perolehan *</Label>
            <Input id="aset-tanggal" type="date" className="mt-1" value={acquisitionDate} onChange={(event) => setAcquisitionDate(event.target.value)} />
            <p className="mt-1 text-xs text-[#8194aa]">Bulan perolehan disusutkan penuh.</p>
          </div>
          <div>
            <Label htmlFor="aset-harga">Harga perolehan *</Label>
            <Input id="aset-harga" className="mt-1 tabular-nums" inputMode="decimal" value={acquisitionCost} onChange={(event) => setAcquisitionCost(event.target.value)} placeholder="24000000.00" />
          </div>
          <div>
            <Label>Kelompok pajak</Label>
            <Select value={taxGroup} onValueChange={(value) => pickTaxGroup(value as (typeof TAX_GROUPS)[number]["value"])} disabled={isLand}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAX_GROUPS.map((group) => (
                  <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="aset-umur">Umur manfaat (bulan) {isLand ? "" : "*"}</Label>
            <Input
              id="aset-umur"
              className="mt-1 tabular-nums"
              inputMode="numeric"
              disabled={isLand}
              value={isLand ? "" : usefulLifeMonths}
              onChange={(event) => setUsefulLifeMonths(event.target.value)}
            />
            <p className="mt-1 text-xs text-[#8194aa]">
              {isLand
                ? "Tanah tidak disusutkan."
                : "Default kelompok pajak (PMK 72/2023). SAK EP menuntut umur manfaat sebenarnya; ubah bila berbeda."}
            </p>
          </div>
          <div>
            <Label htmlFor="aset-residu">Nilai residu</Label>
            <Input id="aset-residu" className="mt-1 tabular-nums" inputMode="decimal" value={residualValue} onChange={(event) => setResidualValue(event.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-[#e6edf5] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="aset-warisan" className="text-sm font-semibold text-[#213f63]">Aset warisan</Label>
              <p className="text-xs text-[#718398]">
                Sudah dimiliki sebelum buku besar ini dipakai. Perolehannya <span className="font-semibold">tidak</span>{" "}
                dijurnal dari sini — saldo Aset Tetap dan Akumulasi Penyusutannya masuk lewat jalur saldo awal.
              </p>
            </div>
            <Switch id="aset-warisan" checked={legacy} onCheckedChange={setLegacy} />
          </div>
          {legacy ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="aset-bulan-pertama">Bulan jurnal pertama *</Label>
                <Input id="aset-bulan-pertama" type="month" className="mt-1" value={firstJournalMonth} onChange={(event) => setFirstJournalMonth(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="aset-akumulasi">Akumulasi penyusutan sampai saat itu *</Label>
                <Input id="aset-akumulasi" className="mt-1 tabular-nums" inputMode="decimal" value={openingAccumulated} onChange={(event) => setOpeningAccumulated(event.target.value)} />
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="aset-catatan">Catatan</Label>
          <Textarea id="aset-catatan" className="mt-1" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button disabled={pending || !ready} onClick={submit}>
            {legacy ? "Daftarkan aset warisan" : "Daftarkan dan jurnalkan perolehannya"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisposeDialog({
  asset,
  pending,
  onOpenChange,
  onSubmit,
}: {
  asset: { id: number; name: string; carrying: string; accumulated: string; acquisitionCost: string } | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { assetId: number; disposalDate: string; proceeds: string; notes?: string }) => void;
}) {
  const [disposalDate, setDisposalDate] = useState("");
  const [proceeds, setProceeds] = useState("0.00");
  const [notes, setNotes] = useState("");

  if (!asset) return null;

  // Pratinjau laba/rugi dihitung dari nilai buku yang sudah ditampilkan tabel — angka yang sama
  // dengan yang dipakai server, karena keduanya datang dari `fixedAssets.list`.
  const gainLoss = Number(proceeds || 0) - Number(asset.carrying);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lepaskan {asset.name}</DialogTitle>
          <DialogDescription>
            Harga perolehan dan akumulasi penyusutannya dikeluarkan dari neraca, dan selisihnya
            terhadap hasil pelepasan jatuh ke Laba/(Rugi) Penjualan Aset Tetap. Hasilnya dicatat
            sebagai piutang, bukan sebagai kas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3 text-sm">
            <div className="flex justify-between"><span className="text-[#718398]">Harga perolehan</span><span className="tabular-nums">{rupiah(asset.acquisitionCost)}</span></div>
            <div className="flex justify-between"><span className="text-[#718398]">Akumulasi penyusutan</span><span className="tabular-nums">{rupiah(asset.accumulated)}</span></div>
            <div className="mt-1 flex justify-between border-t border-[#e6edf5] pt-1 font-semibold text-[#213f63]"><span>Nilai buku</span><span className="tabular-nums">{rupiah(asset.carrying)}</span></div>
          </div>
          <div>
            <Label htmlFor="lepas-tanggal">Tanggal pelepasan *</Label>
            <Input id="lepas-tanggal" type="date" className="mt-1" value={disposalDate} onChange={(event) => setDisposalDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="lepas-hasil">Hasil pelepasan</Label>
            <Input id="lepas-hasil" className="mt-1 tabular-nums" inputMode="decimal" value={proceeds} onChange={(event) => setProceeds(event.target.value)} />
            <p className="mt-1 text-xs text-[#8194aa]">Isi nol untuk penghapusan tanpa hasil.</p>
          </div>
          <div className={`rounded-xl border p-3 text-sm ${gainLoss < 0 ? "border-[#f0d6d6] bg-[#fdf6f6] text-[#9a4b4b]" : "border-[#dde9dc] bg-[#f6fbf5] text-[#4d8548]"}`}>
            {gainLoss === 0
              ? "Impas terhadap nilai bukunya; tidak ada laba maupun rugi."
              : gainLoss > 0
                ? `Laba pelepasan ${rupiah(String(gainLoss))}.`
                : `Rugi pelepasan ${rupiah(String(Math.abs(gainLoss)))}.`}
          </div>
          <div>
            <Label htmlFor="lepas-catatan">Catatan</Label>
            <Textarea id="lepas-catatan" className="mt-1" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Mis. Dijual ke rekanan." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            disabled={pending || !disposalDate}
            onClick={() => onSubmit({ assetId: asset.id, disposalDate, proceeds: proceeds || "0.00", notes: notes.trim() || undefined })}
          >
            Lepaskan aset dan jurnalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
