import { FormSection } from "@/components/patterns/FormSection";
import { StepFlow, type Step } from "@/components/patterns/StepFlow";
import { BOLD_BUTTON, QUIET_FIELD } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, normalizeUsernameInput } from "@shared/accountRules";
import { SETUP_CODE_GROUPS, formatSecretCode, normalizeSecretCode } from "@shared/secretCodes";
import { useState, type ReactNode } from "react";
import { RecoveryCodeSheet } from "./RecoveryCodeSheet";

export type SetupPayload = {
  setupCode: string;
  owner: { name: string; username: string; password: string };
  company: { legalEntityName: string; tradingName: string; licenseNumber?: string };
};

const STEPS: Step[] = [
  { id: "kode", title: "Kode penyiapan" },
  { id: "pemilik", title: "Akun pemilik" },
  { id: "perusahaan", title: "Perusahaan" },
];

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-label text-danger">{error}</p> : hint ? <p className="text-label text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/**
 * "Siapkan perusahaan Anda" (spec 2026-09-26 §2). Tiga langkah bernomor, lalu lembar kode pemulihan
 * sebagai langkah keempat yang hanya muncul sesudah server menyelesaikan penyiapan dalam satu
 * transaksi. Aturan di sini hanya petunjuk; server tetap penegaknya.
 */
export function SetupWizard({ onComplete, errorMessage, isPending, brand, onFinish }: {
  onComplete: (payload: SetupPayload) => Promise<{ recoveryCodes: string[] }>;
  errorMessage: string | null;
  isPending: boolean;
  brand: string;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [legalEntityName, setLegalEntityName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const compactCode = normalizeSecretCode(code, SETUP_CODE_GROUPS);
  const normalizedUsername = normalizeUsernameInput(username);
  const usernameOk = USERNAME_PATTERN.test(normalizedUsername);
  const passwordOk = password.length >= PASSWORD_MIN_LENGTH;
  const matchOk = confirmation !== "" && confirmation === password;
  const ownerOk = name.trim().length >= 3 && usernameOk && passwordOk && matchOk;
  const companyOk = legalEntityName.trim() !== "" && tradingName.trim() !== "";
  const canAdvance = step === 0 ? compactCode !== null : step === 1 ? ownerOk : false;

  async function submit() {
    const result = await onComplete({
      setupCode: formatSecretCode(compactCode!),
      owner: { name: name.trim(), username: normalizedUsername, password },
      company: { legalEntityName: legalEntityName.trim(), tradingName: tradingName.trim(), licenseNumber: licenseNumber.trim() || undefined },
    });
    setRecoveryCodes(result.recoveryCodes);
  }

  if (recoveryCodes) {
    return (
      <section aria-labelledby="langkah-kode-pemulihan" className="grid gap-2">
        <h2 id="langkah-kode-pemulihan" className="text-body font-bold text-ink">4. Simpan kode pemulihan Anda</h2>
        <RecoveryCodeSheet brand={tradingName.trim() || brand} codes={recoveryCodes} continueLabel="Masuk ke aplikasi" onContinue={onFinish} />
      </section>
    );
  }

  return (
    <StepFlow steps={STEPS} currentIndex={step} onStepChange={setStep} canAdvance={canAdvance}>
      {step === 0 ? (
        <FormSection number={1} title="Masukkan kode penyiapan" description="Kode ini dibuat di server dengan perintah node scripts/tenant.mjs setup-code dan berlaku 24 jam.">
          <Field id="setup-code" label="Kode penyiapan" hint="Dua belas huruf atau angka, mis. ABCD-EFGH-JKLM. Huruf kecil dan spasi tidak masalah." error={code !== "" && compactCode === null ? "Kode belum lengkap atau memuat huruf yang tidak dipakai (0, O, 1, I)." : null}>
            <Input id="setup-code" autoComplete="one-time-code" className={`${QUIET_FIELD} font-mono uppercase`} value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
        </FormSection>
      ) : null}
      {step === 1 ? (
        <FormSection number={2} title="Buat akun pemilik" description="Akun ini berperan Pemegang Saham dan satu-satunya yang dapat membuat akun Controller.">
          <Field id="owner-name" label="Nama Anda">
            <Input id="owner-name" autoComplete="name" className={QUIET_FIELD} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="owner-username" label="Username" hint="3–48 karakter: huruf kecil, angka, titik, garis bawah, atau strip." error={username !== "" && !usernameOk ? "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip (3–48 karakter)." : null}>
            <Input id="owner-username" autoComplete="username" className={QUIET_FIELD} value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field id="owner-password" label="Kata sandi" hint={`Minimal ${PASSWORD_MIN_LENGTH} karakter.`} error={password !== "" && !passwordOk ? `Minimal ${PASSWORD_MIN_LENGTH} karakter (saat ini ${password.length}).` : null}>
            <Input id="owner-password" type="password" autoComplete="new-password" className={QUIET_FIELD} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field id="owner-confirmation" label="Ulangi kata sandi" error={confirmation !== "" && !matchOk ? "Belum sama dengan kata sandi." : null}>
            <Input id="owner-confirmation" type="password" autoComplete="new-password" className={QUIET_FIELD} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </Field>
        </FormSection>
      ) : null}
      {step === 2 ? (
        <FormSection number={3} title="Tentang perusahaan Anda" description="Nama tampil di kwitansi, halaman masuk, dan halaman kurs publik. Sisanya dapat dilengkapi nanti di Profil Perusahaan.">
          <Field id="legal-name" label="Nama badan hukum" hint="Mis. PT Contoh Valuta Nusantara.">
            <Input id="legal-name" className={QUIET_FIELD} value={legalEntityName} onChange={(event) => setLegalEntityName(event.target.value)} />
          </Field>
          <Field id="trading-name" label="Nama dagang" hint="Nama yang dikenal nasabah.">
            <Input id="trading-name" className={QUIET_FIELD} value={tradingName} onChange={(event) => setTradingName(event.target.value)} />
          </Field>
          <Field id="license-number" label="Nomor izin KUPVA (boleh nanti)">
            <Input id="license-number" className={QUIET_FIELD} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
          </Field>
          {errorMessage ? <p role="alert" className="rounded-md border-[1.5px] border-danger bg-danger-soft px-2 py-1 text-body text-ink">{errorMessage}</p> : null}
          <Button type="button" className={BOLD_BUTTON} disabled={!companyOk || isPending} onClick={() => { void submit().catch(() => undefined); }}>
            {isPending ? "Menyiapkan…" : "Siapkan perusahaan"}
          </Button>
        </FormSection>
      ) : null}
    </StepFlow>
  );
}
