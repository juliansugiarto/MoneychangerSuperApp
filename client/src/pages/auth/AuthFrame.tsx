import { brandInitials } from "@/components/shell/brand";
import type { ReactNode } from "react";

/**
 * Bingkai layar tanpa akun: logo dan nama dagang dari Profil Perusahaan, satu kartu tebal, tidak ada
 * yang lain (spec program §3.3). `wide` untuk wizard penyiapan.
 */
export function AuthFrame({ brand, logoUrl, title, description, width = "narrow", children }: {
  /** `null` = belum diketahui (profil masih dimuat). */
  brand: string | null;
  logoUrl: string | null;
  title: string;
  description?: string;
  width?: "narrow" | "wide";
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-8">
      <div className={`w-full ${width === "wide" ? "max-w-2xl" : "max-w-sm"}`}>
        <div className="mb-4 flex items-center gap-2">
          {brand === null
            ? <span data-brand-placeholder aria-hidden className="h-9 w-40 rounded-lg bg-surface-sunken" />
            : <>
                {logoUrl
                  ? <img src={logoUrl} alt="" className="size-9 rounded-lg border-2 border-ink bg-surface-raised object-contain" />
                  : <span aria-hidden className="flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-brand font-heading text-label font-extrabold text-brand-contrast shadow-hard">{brandInitials(brand)}</span>}
                <span className="font-heading text-body font-extrabold text-ink">{brand}</span>
              </>}
        </div>
        <section className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4 shadow-tile">
          <h1 className="font-heading text-title font-extrabold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
          <div className="mt-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
