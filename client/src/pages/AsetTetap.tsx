import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

const rupiah = (value: string) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(Number(value));

/**
 * Register aset tetap.
 *
 * Kerangka: daftar aset beserta nilai bukunya. Form pendaftaran, jalur aset warisan, pelepasan,
 * dan pengaturan batas kapitalisasi menyusul pada tugas 10.
 */
export default function AsetTetap() {
  const assets = trpc.fixedAssets.list.useQuery();

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-bold text-[#18395f]">Aset Tetap</h1>
        <p className="text-sm text-slate-600">
          Harga perolehan, akumulasi penyusutan, dan nilai buku setiap aset. Penyusutan bulanannya
          dijurnal dari tab Periode pada halaman Buku Besar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar aset</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : assets.isError ? (
            <p className="text-sm text-red-600">
              Daftar aset tidak dapat dimuat: {assets.error.message}
            </p>
          ) : !assets.data?.length ? (
            <p className="text-sm text-slate-600">
              Belum ada aset tetap yang terdaftar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tanggal perolehan</TableHead>
                    <TableHead className="text-right">Harga perolehan</TableHead>
                    <TableHead className="text-right">Akumulasi</TableHead>
                    <TableHead className="text-right">Nilai buku</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.data.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.name}
                        {asset.assetCode ? <span className="ml-2 text-xs text-slate-500">{asset.assetCode}</span> : null}
                      </TableCell>
                      <TableCell>{asset.category.replace(/_/g, " ").toLowerCase()}</TableCell>
                      <TableCell>{asset.acquisitionDate}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupiah(asset.acquisitionCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupiah(asset.accumulated)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupiah(asset.carrying)}</TableCell>
                      <TableCell>{asset.status === "DILEPAS" ? "Dilepas" : "Aktif"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
