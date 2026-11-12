import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OpeningSchedule } from "@shared/openingStatus";
import { DEFAULT_FRAUD_WARNING, MONEY_RULE_MAX_LENGTH, normalizePublicPage, type MoneyRules, type PublicFaqItem, type PublicPageValues } from "@shared/publicPage";
import { useState } from "react";
import { FaqEditor } from "./FaqEditor";
import { OpeningScheduleEditor, fromScheduleDraft, toScheduleDraft } from "./OpeningScheduleEditor";

type Initial = {
  publicPageEnabled: boolean;
  secondaryPhone: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  publicFaq: PublicFaqItem[] | null;
  fraudWarning: string | null;
  openingSchedule: OpeningSchedule | null;
  moneyRules: MoneyRules | null;
};

const MONEY_RULE_FIELDS = [
  { key: "denominations", label: "Pecahan yang diterima", placeholder: "Mis. USD pecahan 50 dan 100 memakai kurs besar; pecahan kecil kursnya lebih rendah." },
  { key: "condition", label: "Kondisi uang", placeholder: "Mis. Uang robek, bercoret, atau berstempel tidak kami terima." },
  { key: "series", label: "Seri uang", placeholder: "Mis. USD seri sebelum 2006 kursnya berbeda." },
] as const;

/**
 * Kunci pemasangan ulang dari isian halaman publik yang TERSIMPAN saja. Jangan memakai `updatedAt`:
 * menyimpan Tampilan atau Data badan usaha ikut menggesernya, dan isian halaman publik yang sedang
 * diketik akan hilang tanpa peringatan.
 */
export function publicPageKey(profile: Initial): string {
  const { publicPageEnabled, secondaryPhone, openingHours, mapUrl, publicFaq, fraudWarning, openingSchedule, moneyRules } = profile;
  return JSON.stringify([publicPageEnabled, secondaryPhone, openingHours, mapUrl, publicFaq, fraudWarning, openingSchedule, moneyRules]);
}

export function PublicPageSection({ initial, isPending, onSave }: { initial: Initial; isPending: boolean; onSave: (values: PublicPageValues & { publicFaq: PublicFaqItem[] }) => void }) {
  const [enabled, setEnabled] = useState(initial.publicPageEnabled);
  const [secondaryPhone, setSecondaryPhone] = useState(initial.secondaryPhone ?? "");
  const [openingHours, setOpeningHours] = useState(initial.openingHours ?? "");
  const [mapUrl, setMapUrl] = useState(initial.mapUrl ?? "");
  const [faq, setFaq] = useState<PublicFaqItem[]>(initial.publicFaq ?? []);
  const [fraudWarning, setFraudWarning] = useState(initial.fraudWarning ?? "");
  const [schedule, setSchedule] = useState(() => toScheduleDraft(initial.openingSchedule));
  const [moneyRules, setMoneyRules] = useState<MoneyRules>(initial.moneyRules ?? { denominations: null, condition: null, series: null });
  const result = normalizePublicPage({ publicPageEnabled: enabled, secondaryPhone, openingHours, mapUrl, publicFaq: faq, fraudWarning, openingSchedule: fromScheduleDraft(schedule), moneyRules });

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
          <Label htmlFor="secondary-phone">Nomor WhatsApp</Label>
          <Input id="secondary-phone" placeholder="Mis. 0812-3456-7890" className={QUIET_FIELD} value={secondaryPhone} onChange={(event) => setSecondaryPhone(event.target.value)} />
          <p className="text-label text-ink-subtle">Tampil di halaman publik dengan tombol Chat di WhatsApp.</p>
        </div>
        <OpeningScheduleEditor draft={schedule} onChange={setSchedule} />
        <div className="grid gap-1">
          <Label htmlFor="opening-hours">Catatan jam buka</Label>
          <Input id="opening-hours" placeholder="Mis. Tutup pada hari libur nasional" className={QUIET_FIELD} value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} />
          <p className="text-label text-ink-subtle">Boleh kosong. Tampil di bawah jadwal.</p>
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
        <fieldset className="grid gap-2">
          <legend className="text-body font-bold text-ink">Ketentuan uang</legend>
          <p className="text-label text-ink-muted">Tulis hanya yang benar-benar berlaku di outlet. Bila semuanya kosong, bagian ini tidak tampil.</p>
          {MONEY_RULE_FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1">
              <Label htmlFor={`money-rule-${field.key}`}>{field.label}</Label>
              <Textarea id={`money-rule-${field.key}`} rows={2} maxLength={MONEY_RULE_MAX_LENGTH} placeholder={field.placeholder} className={QUIET_FIELD} value={moneyRules[field.key] ?? ""} onChange={(event) => setMoneyRules({ ...moneyRules, [field.key]: event.target.value })} />
            </div>
          ))}
        </fieldset>
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
