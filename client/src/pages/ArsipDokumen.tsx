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
import {
  archiveValidityLabels,
  archiveWorklistReasonLabels,
  companyDocumentCategoryLabels,
  type ArchiveValidityStatus,
  type CompanyDocumentCategory,
} from "@shared/companyDocumentArchive";
import { Archive, CheckCircle2, FileText, History, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Arsip dokumen perusahaan — SOP, kebijakan internal, surat-menyurat BI, notulen rapat, dan
 * korespondensi regulator, beserta riwayat versinya.
 *
 * Halaman ini **hanya mencatat**: worklist masa berlaku tidak memblokir apa pun, tidak mengubah
 * dokumennya, dan tidak mengirim laporan ke regulator mana pun. Menonaktifkan sebuah dokumen tidak
 * menghapusnya — berkasnya tetap dapat dibuka.
 */

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const CATEGORY_ENTRIES = Object.entries(companyDocumentCategoryLabels) as [CompanyDocumentCategory, string][];

const VALIDITY_TONE: Record<ArchiveValidityStatus, string> = {
  BERLAKU: "border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]",
  AKAN_KEDALUWARSA: "border-[#f0e2c4] bg-[#fdf9f0] text-[#8a6d2f]",
  KEDALUWARSA: "border-[#f0d6d6] bg-[#fdf6f6] text-[#9a4b4b]",
  BELUM_BERLAKU: "border-[#dce6f0] bg-[#f7fafd] text-[#4a6a8f]",
};

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";

type FormState = {
  category: CompanyDocumentCategory;
  title: string;
  referenceNumber: string;
  responsibleEmployeeId: string;
  notes: string;
  validFrom: string;
  validUntil: string;
  changeReason: string;
  file: File | null;
};

const emptyForm: FormState = {
  category: "SOP", title: "", referenceNumber: "", responsibleEmployeeId: "", notes: "",
  validFrom: "", validUntil: "", changeReason: "", file: null,
};

export default function ArsipDokumen() {
  const utils = trpc.useUtils();
  const archive = trpc.companyArchive.list.useQuery({});
  const worklist = trpc.companyArchive.worklist.useQuery({});
  const employees = trpc.sdm.employees.useQuery();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [versioning, setVersioning] = useState<{ id: number; title: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: number; title: string } | null>(null);
  const [deactivating, setDeactivating] = useState<{ id: number; title: string } | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");

  const versions = trpc.companyArchive.versions.useQuery(
    { companyDocumentId: historyFor?.id ?? 0 },
    { enabled: historyFor !== null },
  );

  const refresh = () => {
    utils.companyArchive.list.invalidate();
    utils.companyArchive.worklist.invalidate();
  };

  const create = trpc.companyArchive.create.useMutation({
    onSuccess: () => { toast.success("Dokumen diarsipkan."); setCreating(false); setForm(emptyForm); refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const addVersion = trpc.companyArchive.addVersion.useMutation({
    onSuccess: () => { toast.success("Versi baru tersimpan. Versi sebelumnya tetap dapat dibuka."); setVersioning(null); setForm(emptyForm); refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const deactivate = trpc.companyArchive.deactivate.useMutation({
    onSuccess: () => { toast.success("Dokumen dinonaktifkan. Berkasnya tetap tersimpan."); setDeactivating(null); setDeactivationReason(""); refresh(); },
    onError: (error) => toast.error(error.message),
  });

  /** Unggah dua langkah: berkasnya lewat jalur REST yang sudah ada, lalu metadatanya lewat tRPC. */
  const uploadArchiveFile = async (file: File) => {
    const response = await fetch("/api/operational-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType: "COMPANY_ARCHIVE_FILE",
        originalFileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        dataBase64: await fileToBase64(file),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Berkas gagal diunggah.");
    return body.document as { id: number };
  };

  const submitCreate = async () => {
    if (!form.file) return toast.error("Pilih berkas dokumennya terlebih dahulu.");
    if (form.title.trim().length < 3) return toast.error("Judul dokumen wajib diisi.");
    if (!form.validFrom) return toast.error("Tanggal mulai berlaku wajib diisi.");
    setUploading(true);
    try {
      const uploaded = await uploadArchiveFile(form.file);
      await create.mutateAsync({
        category: form.category,
        title: form.title.trim(),
        referenceNumber: form.referenceNumber.trim() || undefined,
        responsibleEmployeeId: form.responsibleEmployeeId ? Number(form.responsibleEmployeeId) : undefined,
        notes: form.notes.trim() || undefined,
        operationalDocumentId: uploaded.id,
        validFrom: new Date(form.validFrom),
        validUntil: form.validUntil ? new Date(form.validUntil) : undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal diarsipkan.");
    } finally {
      setUploading(false);
    }
  };

  const submitVersion = async () => {
    if (!versioning || !form.file) return toast.error("Pilih berkas versi barunya terlebih dahulu.");
    if (form.changeReason.trim().length < 3) return toast.error("Jelaskan alasan penggantian versinya.");
    if (!form.validFrom) return toast.error("Tanggal mulai berlaku wajib diisi.");
    setUploading(true);
    try {
      const uploaded = await uploadArchiveFile(form.file);
      await addVersion.mutateAsync({
        companyDocumentId: versioning.id,
        operationalDocumentId: uploaded.id,
        validFrom: new Date(form.validFrom),
        validUntil: form.validUntil ? new Date(form.validUntil) : undefined,
        changeReason: form.changeReason.trim(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versi baru gagal disimpan.");
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = async (documentId: number) => {
    const url = await utils.documents.downloadUrl.fetch({ documentId });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const grouped = CATEGORY_ENTRIES
    .map(([category, label]) => ({ category, label, items: (archive.data?.documents ?? []).filter((doc) => doc.category === category) }))
    .filter((group) => group.items.length > 0);

  const fileField = (
    <div className="space-y-1.5">
      <Label htmlFor="berkas-arsip">Berkas dokumen</Label>
      <Input
        id="berkas-arsip"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(event) => setForm((state) => ({ ...state, file: event.target.files?.[0] ?? null }))}
      />
      <p className="text-xs text-[#718398]">PDF, JPG, PNG, atau WEBP. Paling besar 8 MB. Hanya berkas internal tepercaya.</p>
    </div>
  );

  const validityFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="mulai-berlaku">Mulai berlaku</Label>
        <Input id="mulai-berlaku" type="date" value={form.validFrom} onChange={(event) => setForm((state) => ({ ...state, validFrom: event.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="berakhir">Berakhir</Label>
        <Input id="berakhir" type="date" value={form.validUntil} onChange={(event) => setForm((state) => ({ ...state, validUntil: event.target.value }))} />
        <p className="text-xs text-[#718398]">Kosongkan bila berlaku sampai diganti.</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <h1 className="font-display text-2xl text-[#18395f]">Arsip Dokumen Perusahaan</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
          SOP, kebijakan internal, surat-menyurat Bank Indonesia, notulen rapat, dan korespondensi
          regulator, beserta riwayat versinya. Versi lama tetap dapat dibuka, sehingga pertanyaan
          "dokumen mana yang berlaku pada periode yang diperiksa" dapat dijawab.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#dce6f0] bg-[#f7fafd] px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5c8f53]" />
          <p className="text-xs leading-5 text-[#475569]">
            <b className="text-[#18395f]">Hanya mencatat.</b> Daftar masa berlaku di bawah tidak memblokir
            apa pun dan tidak mengirim laporan ke Bank Indonesia maupun PPATK. Menonaktifkan dokumen
            <b> tidak menghapusnya</b> — berkasnya tetap tersimpan dan tetap dapat dibuka.
          </p>
        </div>
      </section>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]">
              <Archive className="size-5 text-[#5c8f53]" /> Perlu ditindaklanjuti
            </CardTitle>
            <CardDescription>Dokumen yang masa berlakunya sudah atau segera terlampaui.</CardDescription>
          </div>
          <Button onClick={() => { setForm(emptyForm); setCreating(true); }}>
            <Upload className="mr-2 size-4" /> Arsipkan dokumen
          </Button>
        </CardHeader>
        <CardContent>
          {worklist.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : worklist.isError ? (
            <div className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4">
              <p className="text-sm text-[#9a4b4b]">Daftar tidak dapat dimuat: {worklist.error.message}</p>
              <Button className="mt-3" variant="outline" onClick={() => worklist.refetch()}>Coba lagi</Button>
            </div>
          ) : !worklist.data?.length ? (
            <div className="rounded-xl border border-dashed border-[#dce6f0] p-8 text-center">
              <CheckCircle2 className="mx-auto size-8 text-[#8fb98a]" />
              <p className="mt-3 text-sm font-semibold text-[#213f63]">Tidak ada dokumen yang menunggu tindak lanjut.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {worklist.data.map((item) => (
                <li key={item.id} className="rounded-2xl border border-[#e2eaf2] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#18395f]">{item.title}</p>
                      <p className="text-xs text-[#718398]">
                        {companyDocumentCategoryLabels[item.category as CompanyDocumentCategory] ?? item.category}
                        {item.responsibleName ? ` · Penanggung jawab: ${item.responsibleName}` : " · Penanggung jawab belum ditunjuk"}
                      </p>
                      <p className="mt-2 text-sm text-[#475569]">{archiveWorklistReasonLabels[item.reason]}</p>
                    </div>
                    <div className="text-right text-xs text-[#718398]">
                      <p>Mulai berlaku {formatDate(item.validFrom)}</p>
                      <p>Berakhir {formatDate(item.validUntil)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {archive.data ? (
            <p className="mt-4 text-xs leading-5 text-[#718398]">
              {archive.data.withoutExpiryCount === 0
                ? "Seluruh dokumen aktif punya tanggal berakhir."
                : `${archive.data.withoutExpiryCount} dokumen aktif tidak punya tanggal berakhir, sehingga tidak akan pernah muncul di daftar ini. Daftar yang sunyi bukan bukti seluruh dokumen masih berlaku.`}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[#dce6f0] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl text-[#18395f]">
            <FileText className="size-5 text-[#5c8f53]" /> Dokumen terarsip
          </CardTitle>
          <CardDescription>Dikelompokkan menurut jenisnya, menampilkan versi yang berlaku sekarang.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {archive.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
          ) : archive.isError ? (
            <div className="rounded-xl border border-[#f0d6d6] bg-[#fdf6f6] p-4">
              <p className="text-sm text-[#9a4b4b]">Arsip tidak dapat dimuat: {archive.error.message}</p>
              <Button className="mt-3" variant="outline" onClick={() => archive.refetch()}>Coba lagi</Button>
            </div>
          ) : !grouped.length ? (
            <div className="rounded-xl border border-dashed border-[#dce6f0] p-8 text-center">
              <Archive className="mx-auto size-8 text-[#a8bfd4]" />
              <p className="mt-3 text-sm font-semibold text-[#213f63]">Belum ada dokumen yang diarsipkan.</p>
              <p className="mx-auto mt-1 max-w-xl text-sm text-[#718398]">
                Mulai dari SOP dan kebijakan internal yang berlaku sekarang — keduanya yang paling sering
                diminta pemeriksa.
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <section key={group.category} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#718398]">{group.label}</h2>
                <ul className="space-y-3">
                  {group.items.map((doc) => (
                    <li key={doc.id} className="rounded-2xl border border-[#e2eaf2] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#18395f]">{doc.title}</p>
                            {doc.validityStatus ? (
                              <Badge variant="outline" className={VALIDITY_TONE[doc.validityStatus]}>
                                {archiveValidityLabels[doc.validityStatus]}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-[#718398]">
                            {doc.referenceNumber ? `${doc.referenceNumber} · ` : ""}
                            Versi {doc.currentVersion?.versionNumber ?? "—"} ·
                            {" "}berlaku {formatDate(doc.currentVersion?.validFrom)} s.d. {doc.currentVersion?.validUntil ? formatDate(doc.currentVersion.validUntil) : "diganti"}
                          </p>
                          <p className="mt-1 text-xs text-[#718398]">
                            {doc.responsibleName ? `Penanggung jawab: ${doc.responsibleName}` : "Penanggung jawab belum ditunjuk"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {doc.currentVersion ? (
                            <Button size="sm" variant="outline" onClick={() => viewDocument(doc.currentVersion!.operationalDocumentId)}>Buka</Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => setHistoryFor({ id: doc.id, title: doc.title })}>
                            <History className="mr-1.5 size-3.5" /> Riwayat versi
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm); setVersioning({ id: doc.id, title: doc.title }); }}>Ganti versi</Button>
                          <Button size="sm" variant="ghost" className="text-[#9a4b4b]" onClick={() => { setDeactivationReason(""); setDeactivating({ id: doc.id, title: doc.title }); }}>
                            Nonaktifkan
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {archive.data?.deactivated.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#718398]">Nonaktif</h2>
              <ul className="space-y-2">
                {archive.data.deactivated.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6fafc] px-4 py-3">
                    <div>
                      <p className="text-sm text-[#18395f]">{doc.title}</p>
                      <p className="text-xs text-[#718398]">
                        Nonaktif sejak {formatDate(doc.deactivatedAt)}{doc.deactivationReason ? ` · ${doc.deactivationReason}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {doc.currentVersion ? (
                        <Button size="sm" variant="outline" onClick={() => viewDocument(doc.currentVersion!.operationalDocumentId)}>Buka</Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => setHistoryFor({ id: doc.id, title: doc.title })}>Riwayat versi</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(open) => { if (!open) setCreating(false); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arsipkan dokumen</DialogTitle>
            <DialogDescription>Versi pertama dokumen ini. Alasan perubahan baru diminta saat versinya diganti.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="jenis-dokumen">Jenis dokumen</Label>
              <Select value={form.category} onValueChange={(value) => setForm((state) => ({ ...state, category: value as CompanyDocumentCategory }))}>
                <SelectTrigger id="jenis-dokumen"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_ENTRIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="judul-dokumen">Judul</Label>
              <Input id="judul-dokumen" value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} placeholder="Prosedur Penerimaan Nasabah" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nomor-dokumen">Nomor surat / SK (opsional)</Label>
              <Input id="nomor-dokumen" value={form.referenceNumber} onChange={(event) => setForm((state) => ({ ...state, referenceNumber: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="penanggung-jawab">Penanggung jawab</Label>
              <Select value={form.responsibleEmployeeId || "TIDAK_ADA"} onValueChange={(value) => setForm((state) => ({ ...state, responsibleEmployeeId: value === "TIDAK_ADA" ? "" : value }))}>
                <SelectTrigger id="penanggung-jawab"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIDAK_ADA">Belum ditunjuk</SelectItem>
                  {(employees.data ?? []).map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>{employee.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees.data && employees.data.length === 0 ? (
                <p className="text-xs text-[#718398]">Belum ada data pegawai; isi lewat halaman Kepegawaian lebih dulu.</p>
              ) : null}
            </div>
            {validityFields}
            {fileField}
            <div className="space-y-1.5">
              <Label htmlFor="catatan-dokumen">Catatan (opsional)</Label>
              <Textarea id="catatan-dokumen" rows={2} value={form.notes} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Batal</Button>
              <Button onClick={submitCreate} disabled={uploading || create.isPending}>
                {uploading || create.isPending ? "Menyimpan…" : "Arsipkan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={versioning !== null} onOpenChange={(open) => { if (!open) setVersioning(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ganti versi — {versioning?.title}</DialogTitle>
            <DialogDescription>Versi sebelumnya tidak dihapus; ia tetap tercatat dan tetap dapat dibuka.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {validityFields}
            {fileField}
            <div className="space-y-1.5">
              <Label htmlFor="alasan-perubahan">Alasan perubahan</Label>
              <Textarea
                id="alasan-perubahan"
                rows={3}
                value={form.changeReason}
                onChange={(event) => setForm((state) => ({ ...state, changeReason: event.target.value }))}
                placeholder="Revisi berkala, tindak lanjut temuan pemeriksaan, perubahan ketentuan…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVersioning(null)}>Batal</Button>
              <Button onClick={submitVersion} disabled={uploading || addVersion.isPending}>
                {uploading || addVersion.isPending ? "Menyimpan…" : "Simpan versi baru"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyFor !== null} onOpenChange={(open) => { if (!open) setHistoryFor(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat versi — {historyFor?.title}</DialogTitle>
            <DialogDescription>Seluruh versi yang pernah berlaku, terbaru lebih dulu.</DialogDescription>
          </DialogHeader>
          {versions.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : versions.isError ? (
            <p className="text-sm text-[#9a4b4b]">Riwayat tidak dapat dimuat: {versions.error.message}</p>
          ) : (
            <ul className="space-y-2">
              {(versions.data ?? []).map((version) => (
                <li key={version.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#e2eaf2] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#18395f]">
                      Versi {version.versionNumber}{version.supersededAt ? "" : " · berlaku sekarang"}
                    </p>
                    <p className="text-xs text-[#718398]">
                      {formatDate(version.validFrom)} s.d. {version.validUntil ? formatDate(version.validUntil) : "diganti"}
                      {version.originalFileName ? ` · ${version.originalFileName}` : ""}
                    </p>
                    {version.changeReason ? <p className="mt-1 text-xs text-[#475569]">{version.changeReason}</p> : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => viewDocument(version.operationalDocumentId)}>Buka</Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deactivating !== null} onOpenChange={(open) => { if (!open) setDeactivating(null); }}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nonaktifkan — {deactivating?.title}</DialogTitle>
            <DialogDescription>
              Dokumen tidak dihapus. Ia keluar dari daftar aktif dan dari daftar masa berlaku, tetapi
              berkasnya beserta seluruh riwayat versinya tetap tersimpan dan tetap dapat dibuka.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alasan-nonaktif">Alasan penonaktifan</Label>
              <Textarea id="alasan-nonaktif" rows={3} value={deactivationReason} onChange={(event) => setDeactivationReason(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivating(null)}>Batal</Button>
              <Button
                onClick={() => deactivating && deactivate.mutate({ companyDocumentId: deactivating.id, reason: deactivationReason.trim() })}
                disabled={deactivate.isPending || deactivationReason.trim().length < 3}
              >
                {deactivate.isPending ? "Menyimpan…" : "Nonaktifkan dokumen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
