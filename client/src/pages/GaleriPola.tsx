import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { FormSection, StickyActions } from "@/components/patterns/FormSection";
import { ListDetailLayout } from "@/components/patterns/ListDetailLayout";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { ReportLayout } from "@/components/patterns/ReportLayout";
import { StatTile } from "@/components/patterns/StatTile";
import { StepFlow } from "@/components/patterns/StepFlow";
import { BOLD_BUTTON, OUTLINE_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { applyTheme } from "@/lib/brandAccent";
import { THEME_PALETTES } from "@shared/themePalettes";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Galeri pola — satu halaman yang memperlihatkan setiap token, pola, dan keadaan dengan data contoh
 * statis. Tidak memanggil server sama sekali, sehingga tampilannya stabil untuk dipotret Playwright.
 */

type ContohBon = { id: string; nomor: string; nasabah: string; valuta: string; nilai: string };

const bonContoh: ContohBon[] = [
  { id: "1", nomor: "FX-2026-0914-001", nasabah: "Budi Santoso", valuta: "USD", nilai: "Rp 15.820.000" },
  { id: "2", nomor: "FX-2026-0914-002", nasabah: "Sari Wulandari", valuta: "SGD", nilai: "Rp 4.150.500" },
  { id: "3", nomor: "FX-2026-0914-003", nasabah: "PT Maju Bersama", valuta: "EUR", nilai: "Rp 52.300.000" },
];

const kolomBon: Column<ContohBon>[] = [
  { key: "nomor", header: "Nomor bon", cell: (row) => row.nomor },
  { key: "nasabah", header: "Nasabah", cell: (row) => row.nasabah },
  { key: "valuta", header: "Valuta", cell: (row) => row.valuta },
  { key: "nilai", header: "Nilai Rupiah", cell: (row) => row.nilai, align: "right" },
];

const langkahContoh = [
  { id: "usaha", title: "Tentang usaha Anda" },
  { id: "nasabah", title: "Nasabah, produk, wilayah" },
  { id: "pengendalian", title: "Seberapa siap pengendalian Anda" },
  { id: "hasil", title: "Hasil" },
];

const swatches = [
  ["bg-paper", "Kertas"], ["bg-surface-raised", "Permukaan terangkat"], ["bg-surface-sunken", "Permukaan cekung"], ["bg-ink", "Tinta"],
  ["bg-brand", "Warna utama"], ["bg-second", "Warna kedua"], ["bg-success", "Berhasil"], ["bg-warning", "Perlu perhatian"], ["bg-danger", "Bahaya"], ["bg-info", "Informasi"],
] as const;

/** Pratinjau palet di dalam wadahnya sendiri; tidak menyentuh tema aplikasi dan tidak disimpan. */
function PratinjauPalet() {
  const wadah = useRef<HTMLDivElement>(null);
  const [paletId, setPaletId] = useState<string>(THEME_PALETTES[0].id);
  useEffect(() => {
    if (wadah.current) applyTheme(wadah.current, paletId);
  }, [paletId]);
  return (
    <div>
      <p className="mb-2 text-label font-semibold text-ink-subtle">Pratinjau — tidak disimpan. Pemilik memilih paletnya di Profil Perusahaan.</p>
      <div role="radiogroup" aria-label="Palet" className="mb-3 flex flex-wrap gap-2">
        {THEME_PALETTES.map((palet) => (
          <button key={palet.id} type="button" role="radio" aria-checked={palet.id === paletId} onClick={() => setPaletId(palet.id)} className={palet.id === paletId ? BOLD_BUTTON : OUTLINE_BUTTON}>
            {palet.name}
          </button>
        ))}
      </div>
      <div ref={wadah} data-testid="pratinjau-palet" className="rounded-[0.75rem] border-2 border-ink bg-paper p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Jumlah bon" value="12" tone="brand" />
          <StatTile label="Pembelian" value="Rp 18,4 jt" tone="second" />
          <StatTile label="Penjualan" value="Rp 6,6 jt" />
        </div>
        <div className="mt-3 flex gap-2">
          <Button className={BOLD_BUTTON}>+ Bon baru</Button>
          <Button variant="outline" className={OUTLINE_BUTTON}>Batal</Button>
        </div>
      </div>
    </div>
  );
}

function Bagian({ id, judul, children }: { id: string; judul: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="border-t border-line py-6 first:border-t-0">
      <h2 id={`${id}-judul`} className="mb-3 text-label font-semibold uppercase tracking-wide text-ink-subtle">{judul}</h2>
      {children}
    </section>
  );
}

export default function GaleriPola() {
  const [terpilih, setTerpilih] = useState<ContohBon | null>(null);
  const [langkah, setLangkah] = useState(0);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Galeri pola" description="Setiap layar baru disusun dari pola di halaman ini. Data di sini contoh, bukan data usaha Anda." />

      <Bagian id="token" judul="Token warna dan teks">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {swatches.map(([kelas, nama]) => (
            <div key={kelas} className="overflow-hidden rounded-lg border border-line">
              <div className={`h-10 ${kelas}`} />
              <p className="px-2 py-1 text-label text-ink-muted">{nama}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-title font-semibold text-ink">Judul halaman 20px</p>
        <p className="text-body text-ink">Teks isi 14px — untuk hampir semua kalimat.</p>
        <p className="text-label text-ink-subtle">Label 12px · istilah resmi seperti “Form A1 · TPPU 2A”</p>
      </Bagian>

      <Bagian id="palet" judul="Palet tema">
        <PratinjauPalet />
      </Bagian>

      <Bagian id="kepala-halaman" judul="Kepala halaman">
        <PageHeader
          title="Seberapa berisiko nasabah Anda?"
          officialLabel="Form A1 · Parameter risiko inheren"
          description="Kami sudah mengisi angka yang terhitung dari data bulan ini. Periksa dan koreksi bila perlu."
          actions={<Button className={BOLD_BUTTON}>Simpan draf</Button>}
        />
      </Bagian>

      <Bagian id="keadaan" judul="Keadaan: memuat, kosong, galat">
        <div className="grid gap-3 lg:grid-cols-3">
          <LoadingState label="Memuat contoh daftar" />
          <EmptyState title="Belum ada kas awal hari ini" nextStep="Hitung uang di laci lalu catat sebelum melayani nasabah." actionLabel="Catat kas awal" onAction={() => {}} />
          <ErrorState what="Daftar kurs tidak dapat dimuat." nextStep="Periksa sambungan internet, lalu coba lagi." onRetry={() => {}} />
        </div>
      </Bagian>

      <Bagian id="ubin" judul="Ubin angka">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Transaksi hari ini" value="12" hint="3 menunggu tinjauan" onOpen={() => {}} tone="brand" />
          <StatTile label="Kas Rupiah" value="Rp 25.000.000" tone="second" />
          <StatTile label="Stok USD" value="$ 4.200" hint="Per 09.00 WIB" />
          <StatTile label="Nasabah berisiko tinggi" value="2" hint="Menunggu keputusan Pemegang Saham" onOpen={() => {}} />
        </div>
      </Bagian>

      <Bagian id="tabel" judul="Tabel padat">
        <DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} caption="Contoh daftar bon" />
      </Bagian>

      <Bagian id="daftar-detail" judul="Daftar dengan panel detail">
        <ListDetailLayout
          list={<DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} onSelect={setTerpilih} selectedKey={terpilih?.id ?? null} caption="Pilih bon untuk melihat detail" />}
          detail={terpilih ? <dl className="grid gap-2 text-body"><div><dt className="text-label text-ink-subtle">Nasabah</dt><dd className="text-ink">{terpilih.nasabah}</dd></div><div><dt className="text-label text-ink-subtle">Nilai Rupiah</dt><dd className="tabular-nums text-ink">{terpilih.nilai}</dd></div></dl> : undefined}
          detailTitle={terpilih ? `Bon ${terpilih.nomor}` : undefined}
          onCloseDetail={() => setTerpilih(null)}
        />
      </Bagian>

      <Bagian id="formulir" judul="Formulir bernomor">
        <div className="rounded-lg border border-line bg-surface-raised">
          <div className="px-gutter">
            <FormSection number={1} title="Identitas nasabah" description="Sesuai dokumen identitas yang ditunjukkan.">
              <div className="grid gap-1"><Label htmlFor="contoh-nama">Nama lengkap</Label><Input id="contoh-nama" className={`h-control ${QUIET_FIELD}`} defaultValue="Budi Santoso" /></div>
              <div className="grid gap-1"><Label htmlFor="contoh-nik">NIK</Label><Input id="contoh-nik" className={`h-control ${QUIET_FIELD}`} defaultValue="3203xxxxxxxxxxxx" /></div>
            </FormSection>
            <FormSection number={2} title="Tujuan transaksi">
              <div className="grid gap-1"><Label htmlFor="contoh-tujuan">Untuk apa valuta ini?</Label><Input id="contoh-tujuan" className={`h-control ${QUIET_FIELD}`} defaultValue="Perjalanan ibadah" /></div>
            </FormSection>
          </div>
          <StickyActions><Button variant="outline" className={OUTLINE_BUTTON}>Batal</Button><Button className={BOLD_BUTTON}>Simpan nasabah</Button></StickyActions>
        </div>
      </Bagian>

      <Bagian id="alur" judul="Alur bertahap">
        <StepFlow steps={langkahContoh} currentIndex={langkah} onStepChange={setLangkah}>
          <p className="text-body text-ink-muted">Isi langkah “{langkahContoh[langkah].title}” tampil di sini.</p>
          {langkah === langkahContoh.length - 1 ? <Button className={`mt-3 ${BOLD_BUTTON}`}>Kirim untuk disetujui</Button> : null}
        </StepFlow>
      </Bagian>

      <Bagian id="laporan" judul="Laporan">
        <ReportLayout
          filters={<div className="grid gap-1"><Label htmlFor="contoh-periode">Periode</Label><Input id="contoh-periode" className={`h-control w-44 ${QUIET_FIELD}`} defaultValue="September 2026" /></div>}
          summary={<><StatTile label="Jumlah bon" value="318" tone="brand" /><StatTile label="Nilai beli" value="Rp 1,92 M" /><StatTile label="Nilai jual" value="Rp 2,04 M" /><StatTile label="Selisih kurs" value="Rp 118 jt" /></>}
          table={<DataTable columns={kolomBon} rows={bonContoh} rowKey={(row) => row.id} dense caption="Contoh laporan transaksi" />}
          onExport={() => {}}
          exportLabel="Ekspor Excel"
        />
      </Bagian>
    </div>
  );
}
