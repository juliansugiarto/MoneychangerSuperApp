import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_FRAUD_WARNING, normalizePublicPage, type PublicFaqItem, type PublicPageInput } from "@shared/publicPage";
import { useState } from "react";
import { FaqEditor } from "./FaqEditor";

type Initial = {
  publicPageEnabled: boolean;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
};

/**
 * Kunci pemasangan ulang dari isian halaman publik yang TERSIMPAN saja. Jangan memakai `updatedAt`:
 * menyimpan Tampilan atau Data badan usaha ikut menggesernya, dan isian halaman publik yang sedang
 * diketik akan hilang tanpa peringatan.
 */
export function publicPageKey(profile: Initial): string {
  const { publicPageEnabled, secondaryPhone, openingHours, mapUrl, publicFaq, fraudWarning } = profile;
  return JSON.stringify([publicPageEnabled, secondaryPhone, openingHours, mapUrl, publicFaq, fraudWarning]);
}

export function PublicPageSection({ initial, isPending, onSave }: { initial: Initial; isPending: boolean; onSave: (values: Required<PublicPageInput>) => void }) {
  const [enabled, setEnabled] = useState(initial.publicPageEnabled);
  const [secondaryPhone, setSecondaryPhone] = useState(initial.secondaryPhone ?? "");
  const [openingHours, setOpeningHours] = useState(initial.openingHours ?? "");
  const [mapUrl, setMapUrl] = useState(initial.mapUrl ?? "");
  const [faq, setFaq] = useState<PublicFaqItem[]>(initial.publicFaq ?? []);
  const [fraudWarning, setFraudWarning] = useState(initial.fraudWarning ?? "");
  const result = normalizePublicPage({ publicPageEnabled: enabled, secondaryPhone, openingHours, mapUrl, publicFaq: faq, fraudWarning });

  return (
    <section aria-labelledby="bagian-halaman-publik" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4">
      <h2 id="bagian-halaman-publik" className="font-heading text-body font-extrabold text-ink">Halaman publik</h2>
      <p className="mt-0.5 text-label text-ink-muted">Halaman kurs di alamat utama aplikasi. Alamat dan telepon utama diambil dari Data badan usaha di atas; bagian yang kosong tidak ditampilkan.</p>
      <div className="mt-3 flex items-center gap-2">
        <Switch id="public-page-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="public-page-enabled">Tampilkan halaman kurs publik</Label>
      </div>
      {!enabled ? <p className="mt-1 text-label text-ink-muted">Selama mati, alamat / langsung membuka halaman masuk staf.</p> : null}
      <div className="mt-3 grid max-w-2xl gap-3">
        <div className="grid gap-1">
          <Label htmlFor="secondary-phone">Telepon kedua</Label>
          <Input id="secondary-phone" className={QUIET_FIELD} value={secondaryPhone} onChange={(event) => setSecondaryPhone(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="opening-hours">Jam buka</Label>
          <Input id="opening-hours" placeholder="Mis. Senin–Sabtu 08.00–17.00" className={QUIET_FIELD} value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="map-url">Tautan peta</Label>
          <Input id="map-url" placeholder="https://maps.app.goo.gl/…" className={QUIET_FIELD} value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fraud-warning">Peringatan penipuan</Label>
          <Textarea id="fraud-warning" rows={2} placeholder={DEFAULT_FRAUD_WARNING} className={QUIET_FIELD} value={fraudWarning} onChange={(event) => setFraudWarning(event.target.value)} />
          <p className="text-label text-ink-subtle">Kosongkan untuk memakai kalimat bawaan di atas.</p>
        </div>
        <div className="grid gap-1">
          <p className="text-body font-bold text-ink">Pertanyaan umum</p>
          <FaqEditor items={faq} onChange={setFaq} />
        </div>
        {!result.ok ? <p role="alert" className="text-label text-danger">{result.error}</p> : null}
        <Button type="button" className={BOLD_BUTTON} disabled={!result.ok || isPending} onClick={() => { if (result.ok) onSave({ ...result.values, publicFaq: result.values.publicFaq ?? [] }); }}>
          {isPending ? "Menyimpan…" : "Simpan halaman publik"}
        </Button>
      </div>
    </section>
  );
}
