import { BOLD_BUTTON, OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useId, useState } from "react";

export function recoveryCodesText(brand: string, codes: string[], generatedAt: Date): string {
  const stamp = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(generatedAt);
  return [
    `Kode pemulihan pemilik — ${brand}`,
    `Dibuat ${stamp} WIB`,
    "",
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    "",
    "Setiap kode hanya berlaku sekali. Simpan di tempat terkunci, terpisah dari kata sandi.",
    "Membuat kode baru dari aplikasi membatalkan seluruh kode di lembar ini.",
  ].join("\n");
}

/**
 * Satu-satunya saat kode pemulihan tampil. Server tidak menyimpan kode mentahnya, jadi lembar ini
 * menahan pemilik sampai ia menyatakan sudah menyimpannya.
 */
export function RecoveryCodeSheet({ brand, codes, continueLabel, onContinue }: {
  brand: string;
  codes: string[];
  continueLabel: string;
  onContinue: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const checkboxId = useId();

  function download() {
    const blob = new Blob([recoveryCodesText(brand, codes, new Date())], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kode-pemulihan-pemilik.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3">
      <p className="text-body text-ink-muted">Pakai salah satu kode ini bila Anda lupa kata sandi pemilik. Setiap kode hanya berlaku sekali, dan halaman ini tidak dapat dibuka lagi.</p>
      <ol aria-label="Kode pemulihan" className="grid grid-cols-2 gap-2 rounded-lg border-2 border-ink bg-paper p-3 font-mono text-body font-bold tabular-nums text-ink sm:grid-cols-4">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => window.print()}>Cetak</Button>
        <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={download}>Unduh .txt</Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={checkboxId} checked={saved} onCheckedChange={(value) => setSaved(value === true)} />
        <Label htmlFor={checkboxId}>Saya sudah menyimpannya</Label>
      </div>
      <Button type="button" className={BOLD_BUTTON} disabled={!saved} onClick={onContinue}>{continueLabel}</Button>
    </div>
  );
}
